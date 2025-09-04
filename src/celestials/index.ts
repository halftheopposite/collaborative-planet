import * as THREE from "three";
import {
  CLOUD_LAYER_OFFSET,
  MOON_A,
  MOON_B,
  MOON_K,
  PLANET_RADIUS,
  SATURN_A,
  SATURN_B,
  SATURN_K,
  SUN_A,
  SUN_B,
  SUN_K,
} from "../constants";
import atmosphereFragmentShader from "../shaders/atmosphere.frag.glsl";
import atmosphereVertexShader from "../shaders/atmosphere.vert.glsl";
import moonFragmentShader from "../shaders/moon.frag.glsl";
import moonVertexShader from "../shaders/moon.vert.glsl";
import ringFragmentShader from "../shaders/ring.frag.glsl";
import ringVertexShader from "../shaders/ring.vert.glsl";
import saturnFragmentShader from "../shaders/saturn.frag.glsl";
import saturnVertexShader from "../shaders/saturn.vert.glsl";
import sunSurfaceFragmentShader from "../shaders/sun.frag.glsl";
import sunSurfaceVertexShader from "../shaders/sun.vert.glsl";

// Internal state
let sunOrbit: THREE.Group | null = null;
let cloudMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
let atmosphereMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let sunMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let moonOrbit1: THREE.Group | null = null;
let saturn: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let saturnRings: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> | null = null;
let moonOrbit2: THREE.Group | null = null;
let moon: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let sunAngle = 0;
let saturnAngle = 0;
let moonAngle = 0;

export function create(scene: THREE.Scene) {
  createStars(scene);
  createClouds(scene);
  createAtmosphere(scene);
  createSun(scene);

  // Saturn and its orbit (the one with rings) - now using outer orbit
  moonOrbit1 = new THREE.Group();
  saturn = createSaturn(5);
  moonOrbit1.add(saturn);
  moonOrbit1.rotation.x = 0.2;
  scene.add(moonOrbit1);
  moonOrbit1.add(createOrbitEllipse(SATURN_A, SATURN_B, 0x6688ff, 256, 0.35));
  if (saturn) {
    saturn.material.uniforms.uTintColor.value = new THREE.Color(0xf4e6a1); // Saturn's yellowish color
    saturn.material.uniforms.uTintStrength.value = 0.3;
    saturn.material.uniforms.uBrightness.value = 1.0;
    saturnRings = createMoonRings(7.0, 12.0);
    saturnRings.rotation.x = Math.PI / 2;
    saturnRings.rotation.z = 0.35;
    saturn.add(saturnRings);
  }

  // Regular moon - now using inner orbit
  moonOrbit2 = new THREE.Group();
  moon = createMoon(3.5);
  moonOrbit2.add(moon);
  moonOrbit2.rotation.x = -0.3;
  scene.add(moonOrbit2);
  moonOrbit2.add(createOrbitEllipse(MOON_A, MOON_B, 0x88ff88, 256, 0.35));
}

export function update(time: number, dt: number) {
  // Update sun
  if (sunMesh) {
    const x = SUN_A * Math.cos(sunAngle);
    const z = SUN_B * Math.sin(sunAngle);
    const r = Math.sqrt(x * x + z * z);
    const angularVelocity = SUN_K / (r * r);
    sunAngle += angularVelocity * dt;
    sunMesh.position.set(x, 0, z);
    sunMesh.rotation.y += 0.0005;

    const mat = sunMesh.material as THREE.ShaderMaterial;
    if (mat.uniforms && mat.uniforms.uTime) {
      mat.uniforms.uTime.value = time;
    }
  }

  if (cloudMesh) {
    cloudMesh.rotation.y += 0.0005;
    cloudMesh.rotation.x += 0.0002;
  }

  // Update Saturn - now using outer orbit (SATURN parameters)
  if (saturn && moonOrbit1) {
    const x1 = SATURN_A * Math.cos(saturnAngle);
    const z1 = SATURN_B * Math.sin(saturnAngle);
    const r1 = Math.sqrt(x1 * x1 + z1 * z1);
    const angularVelocity = SATURN_K / (r1 * r1);
    saturnAngle += angularVelocity * dt;
    saturn.position.x = x1;
    saturn.position.z = z1;
    saturn.rotation.y += 0.004;
  }

  // Update moon - now using inner orbit (MOON parameters)
  if (moon && moonOrbit2) {
    const x2 = MOON_A * Math.cos(moonAngle);
    const z2 = MOON_B * Math.sin(moonAngle);
    const r2 = Math.sqrt(x2 * x2 + z2 * z2);
    const angularVelocity = MOON_K / (r2 * r2);
    moonAngle += angularVelocity * dt;
    moon.position.x = x2;
    moon.position.z = z2;
    moon.rotation.y += 0.002;
  }
}

// Internals
function createAtmosphere(scene: THREE.Scene) {
  const atmosphereGeometry = new THREE.SphereGeometry(PLANET_RADIUS + 5, 128, 128);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
  });
  atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  atmosphereMesh.renderOrder = 2;
  scene.add(atmosphereMesh);
}

function createClouds(scene: THREE.Scene) {
  const cloudGeometry = new THREE.SphereGeometry(PLANET_RADIUS + CLOUD_LAYER_OFFSET, 128, 128);
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
  cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloudMesh.renderOrder = 1;
  scene.add(cloudMesh);
}

function createSun(scene: THREE.Scene) {
  sunOrbit = new THREE.Group();
  const sunGeometry = new THREE.SphereGeometry(15, 64, 64);
  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: sunSurfaceVertexShader,
    fragmentShader: sunSurfaceFragmentShader,
  });
  sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
  const sunLight = new THREE.PointLight(0xffffff, 15.0, 0, 1.5);
  sunMesh.add(sunLight);
  sunMesh.position.set(SUN_A * Math.cos(sunAngle), 0, SUN_B * Math.sin(sunAngle));
  sunOrbit.add(sunMesh);
  sunOrbit.add(createOrbitEllipse(SUN_A, SUN_B, 0xffdd66, 256, 0.25));
  scene.add(sunOrbit);
}

function createStars(scene: THREE.Scene) {
  const vertices: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const x = THREE.MathUtils.randFloatSpread(2000);
    const y = THREE.MathUtils.randFloatSpread(2000);
    const z = THREE.MathUtils.randFloatSpread(2000);
    vertices.push(x, y, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.5 });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

function createOrbitEllipse(
  a: number,
  b: number,
  color: number = 0x666666,
  segments: number = 256,
  opacity: number = 0.3
): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(a * Math.cos(t), 0, b * Math.sin(t)));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
}

function createMoon(size: number): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const moonGeometry = new THREE.SphereGeometry(size, 32, 32);
  const moonMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTintColor: { value: new THREE.Color(0xffffff) },
      uTintStrength: { value: 0.0 },
      uBrightness: { value: 1.0 },
    },
    vertexShader: moonVertexShader,
    fragmentShader: moonFragmentShader,
  });
  return new THREE.Mesh(moonGeometry, moonMaterial);
}

function createSaturn(size: number): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const saturnGeometry = new THREE.SphereGeometry(size, 32, 32);
  const saturnMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTintColor: { value: new THREE.Color(0xffffff) },
      uTintStrength: { value: 0.0 },
      uBrightness: { value: 1.0 },
    },
    vertexShader: saturnVertexShader,
    fragmentShader: saturnFragmentShader,
  });
  return new THREE.Mesh(saturnGeometry, saturnMaterial);
}

function createMoonRings(
  innerRadius: number,
  outerRadius: number
): THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> {
  const geom = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color(0xf4f0e8) },
      uColor2: { value: new THREE.Color(0xd8d6d0) },
      uInner: { value: innerRadius },
      uOuter: { value: outerRadius },
      uOpacity: { value: 0.85 },
      uBandFreq: { value: 28.0 },
      uBandContrast: { value: 2.0 },
    },
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geom, mat);
}
