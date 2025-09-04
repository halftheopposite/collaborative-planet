import * as THREE from "three";
import {
  CLOUD_LAYER_OFFSET,
  MARS_A,
  MARS_B,
  MARS_K,
  MOON_A,
  MOON_B,
  MOON_K,
  EARTH_RADIUS,
  SATURN_A,
  SATURN_B,
  SATURN_K,
  SUN_A,
  SUN_B,
  SUN_K,
} from "../constants";
import atmosphereFragmentShader from "../shaders/atmosphere.frag.glsl";
import atmosphereVertexShader from "../shaders/atmosphere.vert.glsl";
import marsFragmentShader from "../shaders/mars.frag.glsl";
import marsVertexShader from "../shaders/mars.vert.glsl";
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
let sunAtmosphereMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let moonOrbit1: THREE.Group | null = null;
let saturn: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let saturnRings: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> | null = null;
let marsOrbit: THREE.Group | null = null;
let mars: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let moonOrbit2: THREE.Group | null = null;
let moon: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let sunAngle = 0;
let saturnAngle = 0;
let marsAngle = 0;
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
    saturn.material.uniforms.uTintColor.value = new THREE.Color(0xffffff); // Neutral tint to preserve natural colors
    saturn.material.uniforms.uTintStrength.value = 0.0; // No tinting - let natural gas giant colors show
    saturn.material.uniforms.uBrightness.value = 1.1; // Slightly brighter for visibility
    saturnRings = createMoonRings(7.0, 12.0);
    saturnRings.rotation.x = Math.PI / 2;
    saturnRings.rotation.z = 0.35;
    saturn.add(saturnRings);
  }

  // Mars and its orbit - middle orbit
  marsOrbit = new THREE.Group();
  mars = createMars(4.2); // Slightly bigger than moon (3.5)
  marsOrbit.add(mars);
  marsOrbit.rotation.x = -0.1;
  scene.add(marsOrbit);
  marsOrbit.add(createOrbitEllipse(MARS_A, MARS_B, 0xff6644, 256, 0.35));

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

    // Update Saturn's material time uniform
    const saturnMat = saturn.material as THREE.ShaderMaterial;
    if (saturnMat.uniforms && saturnMat.uniforms.uTime) {
      saturnMat.uniforms.uTime.value = time;
    }

    // Update rings time uniform if they exist
    if (saturnRings) {
      const ringMat = saturnRings.material as THREE.ShaderMaterial;
      if (ringMat.uniforms && ringMat.uniforms.uTime) {
        ringMat.uniforms.uTime.value = time;
      }
    }
  }

  // Update Mars - middle orbit (MARS parameters)
  if (mars && marsOrbit) {
    const x_mars = MARS_A * Math.cos(marsAngle);
    const z_mars = MARS_B * Math.sin(marsAngle);
    const r_mars = Math.sqrt(x_mars * x_mars + z_mars * z_mars);
    const angularVelocity = MARS_K / (r_mars * r_mars);
    marsAngle += angularVelocity * dt;
    mars.position.x = x_mars;
    mars.position.z = z_mars;
    mars.rotation.y += 0.003;

    // Update Mars material time uniform
    const marsMat = mars.material as THREE.ShaderMaterial;
    if (marsMat.uniforms && marsMat.uniforms.uTime) {
      marsMat.uniforms.uTime.value = time;
    }
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
  const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS + 5, 128, 128);
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
  const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS + CLOUD_LAYER_OFFSET, 128, 128);
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

  // Create yellow atmosphere around the sun
  const sunAtmosphereGeometry = new THREE.SphereGeometry(15 + 3, 64, 64); // slightly larger than sun
  const sunAtmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
          float intensity = pow( 0.7 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 1.5 );
          vec3 glowColor = vec3( 1.0, 0.8, 0.2 ); // Yellow-orange glow
          gl_FragColor = vec4( glowColor, 1.0 ) * intensity;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
  });
  sunAtmosphereMesh = new THREE.Mesh(sunAtmosphereGeometry, sunAtmosphereMaterial);
  sunMesh.add(sunAtmosphereMesh); // Add atmosphere to sun so they move together

  const sunLight = new THREE.PointLight(0xffffff, 15.0, 0, 1.5);
  sunMesh.add(sunLight);
  sunMesh.position.set(SUN_A * Math.cos(sunAngle), 0, SUN_B * Math.sin(sunAngle));
  sunOrbit.add(sunMesh);
  sunOrbit.add(createOrbitEllipse(SUN_A, SUN_B, 0xffdd66, 256, 0.25));
  scene.add(sunOrbit);
}

function createStars(scene: THREE.Scene) {
  const vertices: number[] = [];
  const minDistance = 600; // Minimum distance from center (outside sun's orbit)
  const maxDistance = 1500; // Maximum distance for stars

  for (let i = 0; i < 5000; i++) {
    let x, y, z, distance;

    // Generate stars outside the solar system's elliptical boundary
    do {
      x = THREE.MathUtils.randFloatSpread(2 * maxDistance);
      y = THREE.MathUtils.randFloatSpread(2 * maxDistance);
      z = THREE.MathUtils.randFloatSpread(2 * maxDistance);
      distance = Math.sqrt(x * x + y * y + z * z);
    } while (distance < minDistance || distance > maxDistance);

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

function createMars(size: number): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const marsGeometry = new THREE.SphereGeometry(size, 32, 32);
  const marsMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTintColor: { value: new THREE.Color(0xffffff) },
      uTintStrength: { value: 0.0 },
      uBrightness: { value: 1.0 },
    },
    vertexShader: marsVertexShader,
    fragmentShader: marsFragmentShader,
  });
  return new THREE.Mesh(marsGeometry, marsMaterial);
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
      uColor1: { value: new THREE.Color(0xf8f6f2) }, // Brighter ice white
      uColor2: { value: new THREE.Color(0xe8e2d8) }, // Warm ice tone
      uInner: { value: innerRadius },
      uOuter: { value: outerRadius },
      uOpacity: { value: 0.9 }, // Good visibility
      uBandFreq: { value: 28.0 }, // Original working value
      uBandContrast: { value: 2.0 }, // Original working value
      uTime: { value: 0.0 }, // For animation
    },
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, // Restore the perfect blending mode
  });
  return new THREE.Mesh(geom, mat);
}
