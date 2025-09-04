import * as THREE from "three";
import {
  CLOUD_LAYER_OFFSET,
  EARTH_LAYERS,
  EARTH_RADIUS,
  EARTH_SEGMENTS,
  FOAM_WIDTH,
  MAX_HEIGHT,
  MIN_HEIGHT,
  SCULPT_RADIUS,
  SCULPT_STRENGTH,
  WATER_LEVEL,
  WAVE_AMPLITUDE,
  WAVE_AMPLITUDE_MAX,
  WAVE_AMPLITUDE_MIN,
  WAVE_FREQUENCY,
  WAVE_SPEED,
  type Layer,
} from "../../constants";
import atmosphereFragmentShader from "../../shaders/atmosphere.frag.glsl";
import atmosphereVertexShader from "../../shaders/atmosphere.vert.glsl";
import earthFragmentShader from "../../shaders/earth.frag.glsl";
import earthVertexShader from "../../shaders/earth.vert.glsl";
import waterFragmentShader from "../../shaders/water.frag.glsl";
import waterVertexShader from "../../shaders/water.vert.glsl";
import { fbm3JS } from "../../utils/noise";
import { intersectDisplacedMesh, type DisplacedIntersection } from "../../utils/raycast";
import { BirdSystem } from "./BirdSystem";
import { FishSystem } from "./FishSystem";

export interface EarthConfig {
  size?: number;
  segments?: number;
  minHeight?: number;
  maxHeight?: number;
  waterLevel?: number;
  foamWidth?: number;
  waveAmplitude?: number;
  waveAmplitudeMin?: number;
  waveAmplitudeMax?: number;
  waveFrequency?: number;
  waveSpeed?: number;
  exposure?: number;
  rotationSpeed?: number;
  layers?: Array<{ start: number; color: THREE.Color | number | string }>;
  fishCount?: number;
}

export class Earth {
  private mesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private cloudMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private atmosphereMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  private config: EarthConfig;
  private heightChangeListeners: Array<() => void> = [];
  private birdSystem: BirdSystem | null = null;
  private fishSystem: FishSystem | null = null;

  constructor(config: EarthConfig = {}) {
    this.config = config;
  }

  public create(scene: THREE.Scene): void {
    const geometry = this.createEarthGeometry();
    const material = this.createEarthMaterial();
    this.mesh = new THREE.Mesh(geometry, material);

    // Create water layer
    this.createWaterLayer(this.mesh);

    // Create atmosphere
    this.createAtmosphere(scene);

    // Create clouds
    this.createClouds(scene);

    // Add to scene
    scene.add(this.mesh);

    // Apply layers from config or constants
    this.applyDefaultLayers();

    // Create bird system
    this.birdSystem = new BirdSystem(scene);

    // Create fish system
    this.fishSystem = new FishSystem(scene);
  }

  private createEarthGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const radius = this.config.size || EARTH_RADIUS;
    const segments = this.config.segments || EARTH_SEGMENTS;

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

      for (let y = 0; y <= segments; y++) {
        for (let x = 0; x <= segments; x++) {
          const u = x / segments;
          const v = y / segments;
          const pointOnCube = dir
            .clone()
            .addScaledVector(axisA, (u - 0.5) * 2)
            .addScaledVector(axisB, (v - 0.5) * 2);
          const pointOnSphere = pointOnCube.clone().normalize();
          vertices.push(
            pointOnSphere.x * radius,
            pointOnSphere.y * radius,
            pointOnSphere.z * radius
          );
          normals.push(pointOnSphere.x, pointOnSphere.y, pointOnSphere.z);
          uvs.push(u, v);
          if (x < segments && y < segments) {
            const i = vertexCount + y * (segments + 1) + x;
            indices.push(i, i + 1, i + segments + 1);
            indices.push(i + 1, i + segments + 2, i + segments + 1);
          }
        }
      }
      vertexCount += (segments + 1) * (segments + 1);
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    this.fixUvSeams(geometry);

    // Add height displacement attribute
    const hMap = new Float32Array(geometry.attributes.position.count).fill(0);
    geometry.setAttribute("aHeight", new THREE.BufferAttribute(hMap, 1));

    // Generate initial terrain
    this.generateTerrain(geometry);

    return geometry;
  }

  private fixUvSeams(geometry: THREE.BufferGeometry): void {
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

  private generateTerrain(geometry: THREE.BufferGeometry): void {
    const normalAttr = geometry.attributes.normal as THREE.BufferAttribute;
    const heightAttr = geometry.attributes.aHeight as THREE.BufferAttribute;

    // Terrain generation parameters
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

      const minHeight = this.config.minHeight ?? MIN_HEIGHT;
      const maxHeight = this.config.maxHeight ?? MAX_HEIGHT;
      if (h < minHeight) h = minHeight;
      if (h > maxHeight) h = maxHeight;

      heightAttr.setX(i, h);
    }
    heightAttr.needsUpdate = true;
  }

  private createEarthMaterial(): THREE.ShaderMaterial {
    const minHeight = this.config.minHeight ?? MIN_HEIGHT;
    const maxHeight = this.config.maxHeight ?? MAX_HEIGHT;
    const waterLevel = this.config.waterLevel ?? WATER_LEVEL;
    const foamWidth = this.config.foamWidth ?? FOAM_WIDTH;
    const waveAmplitude = this.config.waveAmplitude ?? WAVE_AMPLITUDE;
    const waveAmplitudeMin = this.config.waveAmplitudeMin ?? WAVE_AMPLITUDE_MIN;
    const waveAmplitudeMax = this.config.waveAmplitudeMax ?? WAVE_AMPLITUDE_MAX;
    const waveFrequency = this.config.waveFrequency ?? WAVE_FREQUENCY;
    const waveSpeed = this.config.waveSpeed ?? WAVE_SPEED;
    const exposure = this.config.exposure ?? 1.15;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCursorPos: { value: new THREE.Vector2(0, 0) },
        uCursorPos3D: { value: new THREE.Vector3() },
        uCursorActive: { value: 0.0 },

        // Normalization bounds
        uMinHeight: { value: minHeight },
        uMaxHeight: { value: maxHeight },

        // Custom layers
        uUseCustomLayers: { value: 0.0 },
        uLayerCount: { value: 0 },
        uLayerStarts: { value: new Float32Array(32).fill(0) },
        uLayerColors: {
          value: Array.from({ length: 32 }, () => new THREE.Vector3(1, 1, 1)),
        },

        // Water/foam
        uWaterLevel: { value: waterLevel },
        uFoamWidth: { value: foamWidth },
        // Wave parameters for foam calculation
        uWaveAmplitude: { value: waveAmplitude },
        uWaveAmplitudeMin: { value: waveAmplitudeMin },
        uWaveAmplitudeMax: { value: waveAmplitudeMax },
        uWaveFrequency: { value: waveFrequency },
        uWaveSpeed: { value: waveSpeed },
        // Color grading
        uExposure: { value: exposure },
      },
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });
  }

  private createWaterLayer(parent: THREE.Mesh): void {
    const radius = this.config.size || EARTH_RADIUS;
    const waterLevel = this.config.waterLevel ?? WATER_LEVEL;
    const waveAmplitude = this.config.waveAmplitude ?? WAVE_AMPLITUDE;
    const waveAmplitudeMin = this.config.waveAmplitudeMin ?? WAVE_AMPLITUDE_MIN;
    const waveAmplitudeMax = this.config.waveAmplitudeMax ?? WAVE_AMPLITUDE_MAX;
    const waveFrequency = this.config.waveFrequency ?? WAVE_FREQUENCY;
    const waveSpeed = this.config.waveSpeed ?? WAVE_SPEED;
    const minHeight = this.config.minHeight ?? MIN_HEIGHT;

    // Water layer: a transparent deep-blue sphere slightly above a typical "sea level"
    const SEA_LEVEL = radius + waterLevel; // base radius + height
    const waterGeom = new THREE.SphereGeometry(
      Math.max(SEA_LEVEL, radius + minHeight + 0.01),
      128,
      128
    );
    const waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEarthRadius: { value: radius },
        uWaveAmplitude: { value: waveAmplitude },
        uWaveAmplitudeMin: { value: waveAmplitudeMin },
        uWaveAmplitudeMax: { value: waveAmplitudeMax },
        uWaveFrequency: { value: waveFrequency },
        uWaveSpeed: { value: waveSpeed },
        uOpacity: { value: 0.72 },
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.waterMesh.renderOrder = 0.5;
    parent.add(this.waterMesh);
  }

  private createAtmosphere(scene: THREE.Scene): void {
    const radius = this.config.size || EARTH_RADIUS;
    const atmosphereGeometry = new THREE.SphereGeometry(radius + 5, 128, 128);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    this.atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.atmosphereMesh.renderOrder = 2;
    scene.add(this.atmosphereMesh);
  }

  private createClouds(scene: THREE.Scene): void {
    const radius = this.config.size || EARTH_RADIUS;
    const cloudGeometry = new THREE.SphereGeometry(radius + CLOUD_LAYER_OFFSET, 128, 128);
    const textureLoader = new THREE.TextureLoader();
    const cloudTexture = textureLoader.load(
      "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png"
    );
    const cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      alphaMap: cloudTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    });
    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.cloudMesh.renderOrder = 1;
    scene.add(this.cloudMesh);
  }

  private applyDefaultLayers(): void {
    if (this.config.layers) {
      this.setLayers(this.config.layers);
    } else if (Array.isArray(EARTH_LAYERS) && EARTH_LAYERS.length > 0) {
      const mapped = EARTH_LAYERS.map((l: Layer) => ({ start: l.start, color: l.color }));
      this.setLayers(mapped);
    }
  }

  public update(time: number, deltaTime?: number): void {
    // Update earth material time uniform
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }

    // Update water material time uniform
    if (this.waterMesh && this.waterMesh.material instanceof THREE.ShaderMaterial) {
      const waterMaterial = this.waterMesh.material as THREE.ShaderMaterial;
      if (waterMaterial.uniforms && waterMaterial.uniforms.uTime) {
        waterMaterial.uniforms.uTime.value = time;
      }
    }

    // Update clouds rotation
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.0005;
      this.cloudMesh.rotation.x += 0.0002;
    }

    // Apply rotation if configured
    if (this.mesh && this.config.rotationSpeed) {
      this.mesh.rotation.y += this.config.rotationSpeed;
    }

    // Update bird system if deltaTime is provided
    if (this.birdSystem && deltaTime !== undefined) {
      this.birdSystem.update(time, deltaTime);
    }

    // Update fish system if deltaTime is provided
    if (this.fishSystem && deltaTime !== undefined) {
      this.fishSystem.update(time, deltaTime);
    }
  }

  // Earth-specific methods
  public setCursor(hit: DisplacedIntersection | null): void {
    if (!this.mesh || !(this.mesh.material instanceof THREE.ShaderMaterial)) return;

    const material = this.mesh.material as THREE.ShaderMaterial;
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
    this.mesh.worldToLocal(localPoint.copy(hit.point));
    material.uniforms.uCursorPos3D.value.copy(localPoint);
  }

  public intersect(raycaster: THREE.Raycaster): DisplacedIntersection | null {
    if (!this.mesh) return null;
    return intersectDisplacedMesh(raycaster, this.mesh);
  }

  public sculptAt(point: THREE.Vector3, direction: 1 | -1): void {
    if (!point || !this.mesh) return;

    const radius = this.config.size || EARTH_RADIUS;
    const localDisplacedPoint = this.mesh.worldToLocal(point.clone());
    const localBasePoint = localDisplacedPoint.normalize().multiplyScalar(radius);
    const heightAttribute = this.mesh.geometry.attributes.aHeight as THREE.BufferAttribute;
    const positionAttribute = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    let needsUpdate = false;
    const brushRadiusSq = SCULPT_RADIUS * SCULPT_RADIUS;
    const tmp = new THREE.Vector3();
    const minHeight = this.config.minHeight ?? MIN_HEIGHT;
    const maxHeight = this.config.maxHeight ?? MAX_HEIGHT;

    for (let i = 0; i < positionAttribute.count; i++) {
      tmp.fromBufferAttribute(positionAttribute, i);
      const distSq = tmp.distanceToSquared(localBasePoint);
      if (distSq < brushRadiusSq) {
        const falloff = 1 - Math.sqrt(distSq) / SCULPT_RADIUS;
        const change = direction * SCULPT_STRENGTH * falloff;
        const oldHeight = heightAttribute.getX(i);
        const newHeight = Math.max(minHeight, Math.min(maxHeight, oldHeight + change));
        if (oldHeight !== newHeight) {
          heightAttribute.setX(i, newHeight);
          needsUpdate = true;
        }
      }
    }
    if (needsUpdate) {
      heightAttribute.needsUpdate = true;
      this.notifyHeightsChanged();
    }
  }

  public setLayers(layers: Array<{ start: number; color: THREE.Color | number | string }>): void {
    if (!this.mesh || !(this.mesh.material instanceof THREE.ShaderMaterial)) return;

    const material = this.mesh.material as THREE.ShaderMaterial;
    const sorted = [...layers]
      .map((l) => ({ start: Math.min(1, Math.max(0, l.start)), color: this.toColor3(l.color) }))
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

  public clearLayers(): void {
    if (!this.mesh || !(this.mesh.material instanceof THREE.ShaderMaterial)) return;

    const material = this.mesh.material as THREE.ShaderMaterial;
    material.uniforms.uLayerCount.value = 0;
    material.uniforms.uUseCustomLayers.value = 0.0;
  }

  public setExposure(exposure: number): void {
    if (!this.mesh || !(this.mesh.material instanceof THREE.ShaderMaterial)) return;

    const material = this.mesh.material as THREE.ShaderMaterial;
    material.uniforms.uExposure.value = Math.max(0, exposure);
  }

  // Persistence helpers
  public onHeightsChanged(cb: () => void): () => void {
    this.heightChangeListeners.push(cb);
    return () => {
      const i = this.heightChangeListeners.indexOf(cb);
      if (i >= 0) this.heightChangeListeners.splice(i, 1);
    };
  }

  private notifyHeightsChanged(): void {
    for (const cb of this.heightChangeListeners) cb();
  }

  public getHeights(): Float32Array {
    if (!this.mesh) return new Float32Array();
    const attr = this.mesh.geometry.attributes.aHeight as THREE.BufferAttribute;
    return new Float32Array(attr.array as Float32Array);
  }

  public setHeights(heights: Float32Array | number[]): void {
    if (!this.mesh) return;
    const attr = this.mesh.geometry.attributes.aHeight as THREE.BufferAttribute;
    const target = attr.array as Float32Array;
    if (heights.length !== target.length) return;

    if (heights instanceof Float32Array) target.set(heights);
    else target.set(heights as number[]);
    attr.needsUpdate = true;
    this.notifyHeightsChanged();
  }

  private toColor3(c: THREE.Color | number | string): THREE.Color {
    return c instanceof THREE.Color ? c : new THREE.Color(c as any);
  }

  // Getters
  public getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  public getWaterMesh(): THREE.Mesh | null {
    return this.waterMesh;
  }

  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }

    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      if (this.waterMesh.material instanceof THREE.Material) {
        this.waterMesh.material.dispose();
      }
    }

    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      if (this.cloudMesh.material instanceof THREE.Material) {
        this.cloudMesh.material.dispose();
      }
    }

    if (this.atmosphereMesh) {
      this.atmosphereMesh.geometry.dispose();
      if (this.atmosphereMesh.material instanceof THREE.Material) {
        this.atmosphereMesh.material.dispose();
      }
    }

    // Dispose bird system
    if (this.birdSystem) {
      this.birdSystem.dispose();
      this.birdSystem = null;
    }

    // Dispose fish system
    if (this.fishSystem) {
      this.fishSystem.dispose();
      this.fishSystem = null;
    }

    this.heightChangeListeners.length = 0;
  }

  public getBirdSystem(): BirdSystem | null {
    return this.birdSystem;
  }

  public getFishSystem(): FishSystem | null {
    return this.fishSystem;
  }

  public setFishCount(count: number): void {
    if (this.fishSystem) {
      this.fishSystem.setFishCount(count);
    }
  }
}
