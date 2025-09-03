import * as THREE from "three";
import {
  FOAM_WIDTH,
  MAX_HEIGHT,
  MIN_HEIGHT,
  PLANET_LAYERS,
  PLANET_RADIUS,
  PLANET_SEGMENTS,
  SCULPT_RADIUS,
  SCULPT_STRENGTH,
  WATER_LEVEL,
  type Layer,
} from "../constants";
import planetFragmentShader from "../shaders/planet.frag.glsl";
import planetVertexShader from "../shaders/planet.vert.glsl";
import { fbm3JS } from "../utils/noise";
import { intersectDisplacedMesh, type DisplacedIntersection } from "../utils/raycast";

export type Planet = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  update: (time: number) => void;
  setCursor: (hit: DisplacedIntersection | null) => void;
  intersect: (raycaster: THREE.Raycaster) => DisplacedIntersection | null;
  sculptAt: (point: THREE.Vector3, direction: 1 | -1) => void;
  // Custom normalized layers [0..1]
  setLayers: (layers: Array<{ start: number; color: THREE.Color | number | string }>) => void;
  clearLayers: () => void;
  setExposure: (exposure: number) => void;
};

function fixUvSeams(geometry: THREE.BufferGeometry): void {
  const uv = geometry.attributes.uv as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  const index = geometry.index as THREE.BufferAttribute | null;
  if (!uv || !index) return;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const uvs = [uv.getX(a), uv.getX(b), uv.getX(c)];
    if (Math.abs(uvs[0] - uvs[1]) > 0.5) {
      if (uvs[0] < 0.5) uv.setX(a, uvs[0] + 1);
      else uv.setX(b, uvs[1] + 1);
    }
    if (Math.abs(uvs[0] - uvs[2]) > 0.5) {
      if (uvs[0] < 0.5) uv.setX(a, uvs[0] + 1);
      else uv.setX(c, uvs[2] + 1);
    }
    if (Math.abs(uvs[1] - uvs[2]) > 0.5) {
      if (uvs[1] < 0.5) uv.setX(b, uvs[1] + 1);
      else uv.setX(c, uvs[2] + 1);
    }
  }
}

export function createPlanet(): Planet {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const directions = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  let vertexCount = 0;
  for (const dir of directions) {
    const axisA = new THREE.Vector3(dir.y, dir.z, dir.x);
    const axisB = new THREE.Vector3().crossVectors(dir, axisA);

    for (let y = 0; y <= PLANET_SEGMENTS; y++) {
      for (let x = 0; x <= PLANET_SEGMENTS; x++) {
        const u = x / PLANET_SEGMENTS;
        const v = y / PLANET_SEGMENTS;
        const pointOnCube = dir
          .clone()
          .addScaledVector(axisA, (u - 0.5) * 2)
          .addScaledVector(axisB, (v - 0.5) * 2);
        const pointOnSphere = pointOnCube.clone().normalize();
        vertices.push(
          pointOnSphere.x * PLANET_RADIUS,
          pointOnSphere.y * PLANET_RADIUS,
          pointOnSphere.z * PLANET_RADIUS
        );
        normals.push(pointOnSphere.x, pointOnSphere.y, pointOnSphere.z);
        uvs.push(u, v);
        if (x < PLANET_SEGMENTS && y < PLANET_SEGMENTS) {
          const i = vertexCount + y * (PLANET_SEGMENTS + 1) + x;
          indices.push(i, i + 1, i + PLANET_SEGMENTS + 1);
          indices.push(i + 1, i + PLANET_SEGMENTS + 2, i + PLANET_SEGMENTS + 1);
        }
      }
    }
    vertexCount += (PLANET_SEGMENTS + 1) * (PLANET_SEGMENTS + 1);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  fixUvSeams(geometry);

  const hMap = new Float32Array(geometry.attributes.position.count).fill(0);
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(hMap, 1));

  // Initial terrain
  const normalAttr = geometry.attributes.normal as THREE.BufferAttribute;
  const heightAttr = geometry.attributes.aHeight as THREE.BufferAttribute;
  const freq1 = 0.8;
  const freq2 = 2.6;
  const freq3 = 6.0;
  const freqR = 3.0;
  const amp1 = 3.2;
  const amp2 = 1.8;
  const amp3 = 0.75;
  const ampR = 0.9;
  const maskFreq = 0.45;
  const maskEdge0 = 0.55;
  const maskEdge1 = 0.72;
  const extraFreq = 8.0;
  const extraAmp = 0.6;
  for (let i = 0; i < normalAttr.count; i++) {
    const nx = normalAttr.getX(i);
    const ny = normalAttr.getY(i);
    const nz = normalAttr.getZ(i);
    const n1 = fbm3JS(nx * freq1, ny * freq1, nz * freq1, 3);
    const n2 = fbm3JS(nx * freq2 + 100.0, ny * freq2 + 100.0, nz * freq2 + 100.0, 3);
    const n3 = fbm3JS(nx * freq3 + 200.0, ny * freq3 + 200.0, nz * freq3 + 200.0, 2);
    const r0 = fbm3JS(nx * freqR + 300.0, ny * freqR + 300.0, nz * freqR + 300.0, 2);
    const ridged = 1.0 - Math.abs(r0) - 0.5;
    let h = n1 * amp1 + n2 * amp2 + n3 * amp3 + ridged * (ampR * 2.0 * 0.5);
    const mBase = fbm3JS(nx * maskFreq + 400.0, ny * maskFreq + 400.0, nz * maskFreq + 400.0, 2);
    const m01 = 0.5 * (mBase + 1.0);
    const mT = Math.max(0, Math.min(1, (m01 - maskEdge0) / (maskEdge1 - maskEdge0)));
    const mask = mT * mT * (3 - 2 * mT);
    if (mask > 0.0) {
      const extra = fbm3JS(
        nx * extraFreq + 500.0,
        ny * extraFreq + 500.0,
        nz * extraFreq + 500.0,
        3
      );
      h += extra * (extraAmp * (mask * mask));
    }
    const sign = h < 0 ? -1 : 1;
    h = sign * Math.pow(Math.abs(h), 1.15);
    if (h < MIN_HEIGHT) h = MIN_HEIGHT;
    if (h > MAX_HEIGHT) h = MAX_HEIGHT;
    heightAttr.setX(i, h);
  }
  heightAttr.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCursorPos: { value: new THREE.Vector2(0, 0) },
      uCursorPos3D: { value: new THREE.Vector3() },
      uCursorActive: { value: 0.0 },

      // Normalization bounds
      uMinHeight: { value: MIN_HEIGHT },
      uMaxHeight: { value: MAX_HEIGHT },

      // Custom layers (disabled by default)
      uUseCustomLayers: { value: 0.0 },
      uLayerCount: { value: 0 },
      uLayerStarts: { value: new Float32Array(32).fill(0) },
      uLayerColors: {
        value: Array.from({ length: 32 }, () => new THREE.Vector3(1, 1, 1)),
      },

      // (lava overlay removed)
      // Water/foam
      uWaterLevel: { value: WATER_LEVEL },
      uFoamWidth: { value: FOAM_WIDTH },
      // Color grading
      uExposure: { value: 1.15 },
    },
    vertexShader: planetVertexShader,
    fragmentShader: planetFragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // Water layer: a transparent deep-blue sphere slightly above a typical "sea level"
  // Sea level defined in constants as height relative to base radius
  const SEA_LEVEL = PLANET_RADIUS + WATER_LEVEL; // base radius + height
  const waterGeom = new THREE.SphereGeometry(
    Math.max(SEA_LEVEL, PLANET_RADIUS + MIN_HEIGHT + 0.01),
    128,
    128
  );
  const waterMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x0a3d66), // deep blue
    transparent: true,
    opacity: 0.72, // slight transparency so shore foam is visible underwater
    depthWrite: false, // don't write depth so underlying shore remains visible
  });
  const waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.renderOrder = 0.5; // render before atmosphere/clouds but after planet by default depth
  mesh.add(waterMesh);

  function update(time: number) {
    material.uniforms.uTime.value = time;
  }

  function setCursor(hit: DisplacedIntersection | null) {
    if (!hit) {
      material.uniforms.uCursorActive.value = 0.0;
      return;
    }
    const uv = hit.uv.clone();
    uv.x = THREE.MathUtils.euclideanModulo(uv.x, 1.0);
    uv.y = THREE.MathUtils.euclideanModulo(uv.y, 1.0);
    material.uniforms.uCursorPos.value.copy(uv);
    material.uniforms.uCursorActive.value = 1.0;
    const localPoint = new THREE.Vector3();
    mesh.worldToLocal(localPoint.copy(hit.point));
    material.uniforms.uCursorPos3D.value.copy(localPoint);
  }

  function intersect(raycaster: THREE.Raycaster) {
    return intersectDisplacedMesh(raycaster, mesh);
  }

  function sculptAt(point: THREE.Vector3, direction: 1 | -1) {
    if (!point) return;
    const localDisplacedPoint = mesh.worldToLocal(point.clone());
    const localBasePoint = localDisplacedPoint.normalize().multiplyScalar(PLANET_RADIUS);
    const heightAttribute = mesh.geometry.attributes.aHeight as THREE.BufferAttribute;
    const positionAttribute = mesh.geometry.attributes.position as THREE.BufferAttribute;
    let needsUpdate = false;
    const brushRadiusSq = SCULPT_RADIUS * SCULPT_RADIUS;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < positionAttribute.count; i++) {
      tmp.fromBufferAttribute(positionAttribute, i);
      const distSq = tmp.distanceToSquared(localBasePoint);
      if (distSq < brushRadiusSq) {
        const falloff = 1 - Math.sqrt(distSq) / SCULPT_RADIUS;
        const change = direction * SCULPT_STRENGTH * falloff;
        const oldHeight = heightAttribute.getX(i);
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, oldHeight + change));
        if (oldHeight !== newHeight) {
          heightAttribute.setX(i, newHeight);
          needsUpdate = true;
        }
      }
    }
    if (needsUpdate) heightAttribute.needsUpdate = true;
  }
  function toColor3(c: THREE.Color | number | string): THREE.Color {
    return c instanceof THREE.Color ? c : new THREE.Color(c as any);
  }

  function setLayers(layers: Parameters<Planet["setLayers"]>[0]) {
    const sorted = [...layers]
      .map((l) => ({ start: Math.min(1, Math.max(0, l.start)), color: toColor3(l.color) }))
      .sort((a, b) => a.start - b.start);
    const max = 32;
    const count = Math.min(sorted.length, max);
    const starts = new Float32Array(max).fill(0);
    const colors = Array.from({ length: max }, () => new THREE.Vector3());
    for (let i = 0; i < count; i++) {
      starts[i] = sorted[i].start;
      const c = sorted[i].color.clone().convertSRGBToLinear();
      colors[i].set(c.r, c.g, c.b);
    }
    material.uniforms.uLayerStarts.value = starts;
    material.uniforms.uLayerColors.value = colors;
    material.uniforms.uLayerCount.value = count;
    material.uniforms.uUseCustomLayers.value = count > 0 ? 1.0 : 0.0;
  }

  function clearLayers() {
    material.uniforms.uLayerCount.value = 0;
    material.uniforms.uUseCustomLayers.value = 0.0; // kept for backward compatibility in shader logic
  }

  function setExposure(exposure: number) {
    material.uniforms.uExposure.value = Math.max(0, exposure);
  }

  // Apply PLANET_LAYERS from constants if provided
  if (Array.isArray(PLANET_LAYERS) && PLANET_LAYERS.length > 0) {
    const mapped: { start: number; color: THREE.Color | number | string }[] = PLANET_LAYERS.map(
      (l: Layer) => ({ start: l.start, color: l.color })
    );
    setLayers(mapped);
  }

  return {
    mesh,
    update,
    setCursor,
    intersect,
    sculptAt,
    setLayers,
    clearLayers,
    setExposure,
  };
}
