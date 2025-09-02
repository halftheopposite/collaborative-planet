import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

// --- Configuration ---
const PLANET_RADIUS = 60;
const PLANET_SEGMENTS = 64; // Segments per cube face for Quad Sphere
const MAX_HEIGHT = 5;
const MIN_HEIGHT = -3.75;
const SCULPT_RADIUS = 3;
const SCULPT_STRENGTH = 0.75;

// --- Core Scene Variables ---
let scene!: THREE.Scene;
let camera!: THREE.PerspectiveCamera;
let renderer!: THREE.WebGLRenderer;
let controls!: OrbitControls;
let clock!: THREE.Clock;

let planetMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null =
  null;
let sunOrbit: THREE.Group | null = null;
let cloudMesh: THREE.Mesh<
  THREE.SphereGeometry,
  THREE.MeshBasicMaterial
> | null = null;
let atmosphereMesh: THREE.Mesh<
  THREE.SphereGeometry,
  THREE.ShaderMaterial
> | null = null;
let sunMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null =
  null;

let moonOrbit1: THREE.Group | null = null;
let moon1: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
let moon1Rings: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> | null =
  null;
let moonOrbit2: THREE.Group | null = null;
let moon2: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null; // New variables for moons

let isPointerDown: boolean = false;
let pointerButton: number = -1;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastSculptTime: number = 0;
let coordsDisplay: HTMLElement | null = null;

// --- New variables for moon physics ---
let moon1Angle = 0;
let moon2Angle = 0;
let lastTime = 0;
let sunAngle = 0;

// --- Orbit parameters (semi-axes and Kepler-like speed constants) ---
const MOON1_A = 130; // semi-major axis
const MOON1_B = 110; // semi-minor axis
const MOON1_K = 3600; // speed constant

const MOON2_A = 180;
const MOON2_B = 145;
const MOON2_K = 4000;

const SUN_A = 520; // doubled semi-major axis
const SUN_B = 400; // doubled semi-minor axis
const SUN_K = 12000; // much slower than moons

// --- GLSL Shaders ---
const vertexShader = `
            attribute float aHeight;
            varying float vHeight;
            varying vec2 vUv; 
            varying vec3 vNormal; // Pass normal to fragment shader
            varying vec3 vPosition; // Pass model-space position to fragment shader
            void main() {
                vUv = uv; 
                vHeight = aHeight;
                vNormal = normalize(normal); // Assign the normal
                vPosition = position; // Assign the model-space position
                vec3 displacedPosition = position + normal * aHeight;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
            }
        `;
const fragmentShader = `
            varying float vHeight;
            varying vec2 vUv; 
            varying vec3 vNormal; // Receive normal from vertex shader
            varying vec3 vPosition; // Receive model-space position
            uniform float uTime;
            uniform vec2 uCursorPos;
            uniform vec3 uCursorPos3D; // Receive 3D cursor position
            uniform float uCursorActive;
            // --- Noise functions copied from Sun Shader for Lava Effect ---
            vec3 random3(vec3 st) {
                st = vec3(dot(st, vec3(127.1, 311.7, 74.7)),
                          dot(st, vec3(269.5, 183.3, 246.1)),
                          dot(st, vec3(113.5, 271.9, 124.6)));
                return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
            }
            float noise3(vec3 st) {
                vec3 i = floor(st);
                vec3 f = fract(st);
                vec3 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix( dot( random3(i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ),
                                    dot( random3(i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ),
                                    dot( random3(i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
                           mix(mix( dot( random3(i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ),
                                    dot( random3(i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ),
                                    dot( random3(i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z);
            }
            float fbm3(vec3 st) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 4; i++) {
                    value += amplitude * noise3(st);
                    st *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
            vec3 blend(vec3 color1, vec3 color2, float t) {
                return mix(color1, color2, smoothstep(0.0, 1.0, t));
            }
            void main() {
                vec3 snowColor = vec3(1.0, 1.0, 1.0);
                vec3 rockColor = vec3(0.5, 0.5, 0.5);
                vec3 grassColor = vec3(0.2, 0.6, 0.25);
                vec3 dirtColor = vec3(0.45, 0.3, 0.15);
                vec3 burntOrangeColor = vec3(0.8, 0.4, 0.1); // New intermediate color
                
                // --- Turbulent & Pulsating Lava Effect ---
                vec3 noisyPos = normalize(vPosition) * 2.5; // Use vertex position for noise
                noisyPos.xy += uTime * 0.15; // Animate the noise slowly
                float noise = fbm3(noisyPos);
                
                float pulse = 0.5 + 0.5 * sin(uTime * 1.5); // Much slower pulse
                
                vec3 baseLavaColor = vec3(0.9, 0.2, 0.0);
                vec3 hotLavaColor = vec3(1.0, 0.8, 0.3); 
                // Create a swirling texture with the noise, and use the pulse to control the overall brightness
                vec3 turbulentLava = mix(baseLavaColor, hotLavaColor, pow(noise, 2.0));
                vec3 lavaColor = turbulentLava * (1.0 + pulse * 0.7);
                // --- Smoother, Gradual Color Blending ---
                // We layer colors from the bottom up, using smoothstep for gentle transitions.
                vec3 finalColor = lavaColor;
                finalColor = mix(finalColor, burntOrangeColor, smoothstep(-3.75, -3.0, vHeight));
                finalColor = mix(finalColor, dirtColor,        smoothstep(-3.0, -2.0, vHeight));
                finalColor = mix(finalColor, grassColor,       smoothstep(-2.0, 0.0, vHeight));
                finalColor = mix(finalColor, rockColor,        smoothstep(0.0, 2.0, vHeight));
                finalColor = mix(finalColor, snowColor,        smoothstep(2.0, 3.75, vHeight));
                // --- Equator Line Logic ---
                float equatorThickness = 0.005;
                vec3 equatorColor = vec3(1.0, 1.0, 1.0); 
                if (abs(vNormal.y) < equatorThickness) {
                    float equatorFactor = 1.0 - abs(vNormal.y) / equatorThickness;
                    finalColor = mix(finalColor, equatorColor, equatorFactor * 0.5); // Blend with 50% opacity
                }
                // --- Cursor Logic (3D Version) ---
                if (uCursorActive > 0.5) {
                    vec3 cursorColor = vec3(1.0, 1.0, 1.0);
                    float cursorRadius = 3.0; // Same as SCULPT_RADIUS
                    float cursorThickness = 0.2; // Thickness in world units
                    // Calculate distance in 3D model space
                    float dist = distance(vPosition, uCursorPos3D);
                    
                    // Draw a ring based on the 3D distance
                    if (dist > cursorRadius - cursorThickness && dist < cursorRadius + cursorThickness) {
                        float fade = 1.0 - (abs(dist - cursorRadius) / cursorThickness);
                        finalColor = mix(finalColor, cursorColor, smoothstep(0.0, 1.0, fade) * 0.7); 
                    }
                }
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

// --- Moon GLSL Shaders ---
const moonVertexShader = `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
const moonFragmentShader = `
            uniform float uTime;
            uniform vec3 uTintColor;
            uniform float uTintStrength; // 0..1
            uniform float uBrightness; // overall multiplier
            varying vec3 vPosition;
            // --- Noise functions for moon surface ---
            vec3 random3(vec3 st) {
                st = vec3(dot(st, vec3(127.1, 311.7, 74.7)),
                          dot(st, vec3(269.5, 183.3, 246.1)),
                          dot(st, vec3(113.5, 271.9, 124.6)));
                return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
            }
            float noise3(vec3 st) {
                vec3 i = floor(st);
                vec3 f = fract(st);
                vec3 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix( dot( random3(i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ),
                                    dot( random3(i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ),
                                    dot( random3(i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
                           mix(mix( dot( random3(i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ),
                                    dot( random3(i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ),
                                    dot( random3(i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z);
            }
            float fbm3(vec3 st) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 5; i++) { // 5 octaves for more detail
                    value += amplitude * noise3(st);
                    st *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
      void main() {
                vec3 noisyPos = normalize(vPosition) * 4.0; // Scale for crater-like features
                float n = fbm3(noisyPos);
                // Create a sharp contrast for crater edges
                float craters = smoothstep(0.0, 0.1, abs(n));
        vec3 mariaColor = vec3(0.30, 0.30, 0.34); // Dark gray "seas"
        vec3 highlandColor = vec3(0.8, 0.8, 0.8); // Lighter gray highlands (brighter)
                
                // Mix colors based on noise, and use the crater mask to add highlights
                vec3 finalColor = mix(mariaColor, highlandColor, smoothstep(-0.2, 0.2, n));
        finalColor += vec3(1.0) * craters * 0.1;
        // Apply tint and brightness
        finalColor = mix(finalColor, uTintColor, clamp(uTintStrength, 0.0, 1.0));
        finalColor *= uBrightness;
        gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

// --- Ring GLSL for Saturn-like rings ---
const ringVertexShader = `
      varying vec2 vPos;
      void main(){
        vPos = position.xy; // local XY plane for ring geometry
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
const ringFragmentShader = `
      varying vec2 vPos;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uInner;
      uniform float uOuter;
      uniform float uOpacity;
      uniform float uBandFreq;
      uniform float uBandContrast;
      void main(){
        float r = length(vPos);
        if(r < uInner || r > uOuter){ discard; }
        float radial = clamp((r - uInner) / max(0.0001, (uOuter - uInner)), 0.0, 1.0);
        // Soft edges
        float edge = 0.06; // relative softness
        float alpha = smoothstep(0.0, edge, radial) * (1.0 - smoothstep(1.0 - edge, 1.0, radial));
        // Banding pattern along radius
        float bands = 0.5 + 0.5 * sin((radial * uBandFreq) * 6.28318530718);
        bands = pow(bands, uBandContrast);
        vec3 color = mix(uColor1, uColor2, bands);
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `;

// --- Sun GLSL Shaders ---
const sunSurfaceVertexShader = `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
const sunSurfaceFragmentShader = `
            uniform float uTime;
            varying vec3 vPosition;
            // 3D Random function
            vec3 random3(vec3 st) {
                st = vec3(dot(st, vec3(127.1, 311.7, 74.7)),
                          dot(st, vec3(269.5, 183.3, 246.1)),
                          dot(st, vec3(113.5, 271.9, 124.6)));
                return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
            }
            // 3D Perlin noise for seamless spherical mapping
            float noise3(vec3 st) {
                vec3 i = floor(st);
                vec3 f = fract(st);
                vec3 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix( dot( random3(i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ),
                                    dot( random3(i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ),
                                    dot( random3(i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
                           mix(mix( dot( random3(i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ),
                                    dot( random3(i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                               mix( dot( random3(i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ),
                                    dot( random3(i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z);
            }
            // Fractal Brownian Motion (fbm) for a turbulent look
            float fbm3(vec3 st) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 4; i++) {
                    value += amplitude * noise3(st);
                    st *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
            void main() {
                vec3 noisyPos = normalize(vPosition) * 1.5; 
                noisyPos.x += uTime * 0.1; 
                float n = fbm3(noisyPos);
                
                vec3 color1 = vec3(0.8, 0.3, 0.0);    
                vec3 color2 = vec3(1.0, 0.7, 0.2);    
                vec3 color3 = vec3(1.0, 1.0, 0.9);    
                
                vec3 finalColor = mix(color1, color2, n * 2.0);
                finalColor = mix(finalColor, color3, pow(n, 2.0)); 
                finalColor *= 2.5;
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

// --- Atmosphere GLSL Shaders ---
const atmosphereVertexShader = `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize( normalMatrix * normal );
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `;

const atmosphereFragmentShader = `
            varying vec3 vNormal;
            void main() {
                float intensity = pow( 0.7 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 1.5 );
                vec3 glowColor = vec3( 0.3, 0.6, 1.0 );
                gl_FragColor = vec4( glowColor, 1.0 ) * intensity;
            }
        `;

// --- Initialization ---
function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();
  coordsDisplay = document.getElementById("coords-display");
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 150);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 80;
  controls.maxDistance = 300;
  controls.enablePan = false;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  };
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  createStars();
  createPlanet();
  createClouds();
  createAtmosphere();
  createSun();

  // --- Create the two moons ---
  moonOrbit1 = new THREE.Group();
  moon1 = createMoon(5); // Create a moon with radius 5
  moonOrbit1.add(moon1);
  moonOrbit1.rotation.x = 0.2; // Tilt the orbital plane
  scene.add(moonOrbit1);
  // Add visual ellipse for moon 1 orbit
  moonOrbit1.add(createOrbitEllipse(MOON1_A, MOON1_B, 0x6688ff, 256, 0.35));
  // Make moon1 whiter and give it rings
  if (moon1) {
    moon1.material.uniforms.uTintColor.value = new THREE.Color(0xffffff);
    moon1.material.uniforms.uTintStrength.value = 0.7;
    moon1.material.uniforms.uBrightness.value = 1.2;
    moon1Rings = createMoonRings(7.0, 12.0);
    moon1Rings.rotation.x = Math.PI / 2; // ring in XZ plane around the moon
    moon1Rings.rotation.z = 0.35; // gentle tilt
    moon1.add(moon1Rings);
  }

  moonOrbit2 = new THREE.Group();
  moon2 = createMoon(3.5); // Create a smaller moon
  moonOrbit2.add(moon2);
  moonOrbit2.rotation.x = -0.3; // Tilt the orbital plane in the other direction
  scene.add(moonOrbit2);
  // Add visual ellipse for moon 2 orbit
  moonOrbit2.add(createOrbitEllipse(MOON2_A, MOON2_B, 0x88ff88, 256, 0.35));

  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerout", () => {
    if (planetMesh) planetMesh.material.uniforms.uCursorActive.value = 0.0;
  });
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault()
  );
}

// --- Object Creation ---
// --- FIX: Replaced SphereGeometry with Quad Sphere generation ---
function createPlanet() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

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

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  // --- FIX 2: Added seam-fixing logic for accurate raycasting ---
  fixUvSeams(geometry);

  const hMap = new Float32Array(geometry.attributes.position.count).fill(0);
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(hMap, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCursorPos: { value: new THREE.Vector2(0, 0) },
      uCursorPos3D: { value: new THREE.Vector3() },
      uCursorActive: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
  });

  planetMesh = new THREE.Mesh(geometry, material);
  scene.add(planetMesh);
}

function fixUvSeams(geometry: THREE.BufferGeometry): void {
  const uv = geometry.attributes.uv as
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute;
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

function createAtmosphere() {
  // Using a smooth SphereGeometry for the atmosphere, independent of the planet's mesh
  const atmosphereGeometry = new THREE.SphereGeometry(
    PLANET_RADIUS + 5,
    128,
    128
  );

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

function createClouds() {
  // Using a smooth SphereGeometry for clouds, independent of the planet's mesh
  const cloudGeometry = new THREE.SphereGeometry(PLANET_RADIUS + 1.5, 128, 128);

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

// Create a thin ellipse line to visualize an orbit in the local XZ plane
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

function createMoon(
  size: number
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
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
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  return moonMesh;
}

function createMoonRings(
  innerRadius: number,
  outerRadius: number
): THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> {
  const geom = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: { value: new THREE.Color(0xf4f0e8) }, // light cream
      uColor2: { value: new THREE.Color(0xd8d6d0) }, // slightly darker bands
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

function createSun() {
  sunOrbit = new THREE.Group();

  const sunGeometry = new THREE.SphereGeometry(15, 64, 64);
  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: sunSurfaceVertexShader,
    fragmentShader: sunSurfaceFragmentShader,
  });
  sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);

  /* const coronaGeometry = new THREE.SphereGeometry(15 + 3, 64, 64);
            const coronaMaterial = new THREE.ShaderMaterial({
                vertexShader: atmosphereVertexShader,
                fragmentShader: `
                    varying vec3 vNormal;
                    void main() {
                        float intensity = pow(0.8 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.0);
                        vec3 glowColor = vec3(1.0, 0.6, 0.1);
                        gl_FragColor = vec4(glowColor, 1.0) * intensity;
                    }
                `,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide,
                transparent: true,
            });
            const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
            sunMesh.add(coronaMesh); */

  const sunLight = new THREE.PointLight(0xffffff, 15.0, 0, 1.5);

  /* const textureLoader = new THREE.TextureLoader();
            const textureFlare0 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');
            const textureFlare3 = textureLoader.load('https://threejs.org/examples/textures/lensflare/lensflare3.png');
            const lensflare = new Lensflare();
            lensflare.addElement( new LensflareElement( textureFlare0, 900, 0, sunLight.color ) );
            lensflare.addElement( new LensflareElement( textureFlare3, 60, 0.6 ) );
            lensflare.addElement( new LensflareElement( textureFlare3, 70, 0.7 ) );
            lensflare.addElement( new LensflareElement( textureFlare3, 120, 0.9 ) );
            lensflare.addElement( new LensflareElement( textureFlare3, 70, 1.0 ) );
            sunLight.add(lensflare); */

  sunMesh.add(sunLight);

  // Place initial sun position on ellipse
  sunMesh.position.set(
    SUN_A * Math.cos(sunAngle),
    0,
    SUN_B * Math.sin(sunAngle)
  );

  sunOrbit.add(sunMesh);
  // Add visual ellipse for sun path
  sunOrbit.add(createOrbitEllipse(SUN_A, SUN_B, 0xffdd66, 256, 0.25));
  scene.add(sunOrbit);
}

function createStars() {
  const vertices = [];
  for (let i = 0; i < 5000; i++) {
    const x = THREE.MathUtils.randFloatSpread(2000);
    const y = THREE.MathUtils.randFloatSpread(2000);
    const z = THREE.MathUtils.randFloatSpread(2000);
    vertices.push(x, y, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  const material = new THREE.PointsMaterial({
    color: 0x888888,
    size: 0.5,
  });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

function sculptPlanet(point: THREE.Vector3, direction: number): void {
  if (!point || !planetMesh) return;
  const localDisplacedPoint = planetMesh.worldToLocal(point.clone());
  const localBasePoint = localDisplacedPoint
    .normalize()
    .multiplyScalar(PLANET_RADIUS);
  const heightAttribute = planetMesh.geometry.attributes.aHeight;
  const positionAttribute = planetMesh.geometry.attributes.position;
  let needsUpdate = false;
  const brushRadiusSq = SCULPT_RADIUS * SCULPT_RADIUS;
  for (let i = 0; i < positionAttribute.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(
      positionAttribute,
      i
    );
    const distSq = vertex.distanceToSquared(localBasePoint);
    if (distSq < brushRadiusSq) {
      const falloff = 1 - Math.sqrt(distSq) / SCULPT_RADIUS;
      const change = direction * SCULPT_STRENGTH * falloff;
      const oldHeight = heightAttribute.getX(i);
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, oldHeight + change)
      );
      if (oldHeight !== newHeight) {
        heightAttribute.setX(i, newHeight);
        needsUpdate = true;
      }
    }
  }
  if (needsUpdate) {
    heightAttribute.needsUpdate = true;
  }
}

function intersectDisplacedMesh(
  raycaster: THREE.Raycaster,
  displacedMesh: THREE.Mesh | null
): { point: THREE.Vector3; distance: number; uv: THREE.Vector2 } | null {
  if (!displacedMesh || !displacedMesh.geometry) return null;

  const geometry = displacedMesh.geometry;
  const matrixWorld = displacedMesh.matrixWorld;
  const positionAttribute = geometry.attributes.position;
  const heightAttribute = geometry.attributes.aHeight;
  const normalAttribute = geometry.attributes.normal;
  const uvAttribute = geometry.attributes.uv;
  const index = geometry.index;

  if (
    !index ||
    !positionAttribute ||
    !heightAttribute ||
    !normalAttribute ||
    !uvAttribute
  )
    return null;

  const inverseMatrix = new THREE.Matrix4();
  const ray = new THREE.Ray();
  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3();
  const nA = new THREE.Vector3(),
    nB = new THREE.Vector3(),
    nC = new THREE.Vector3();
  const uvA = new THREE.Vector2(),
    uvB = new THREE.Vector2(),
    uvC = new THREE.Vector2();
  const intersectionPoint = new THREE.Vector3();
  const intersectionPointWorld = new THREE.Vector3();
  const barycentric = new THREE.Vector3();
  const interpolatedUv = new THREE.Vector2();

  inverseMatrix.copy(matrixWorld).invert();
  ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

  let closestIntersection = null;

  // Narrow commonly used attributes to BufferAttribute for TS helper methods
  const posAttr = positionAttribute as THREE.BufferAttribute;
  const normAttr = normalAttribute as THREE.BufferAttribute;
  const uvAttr = uvAttribute as THREE.BufferAttribute;

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    vA.fromBufferAttribute(posAttr, a);
    vB.fromBufferAttribute(posAttr, b);
    vC.fromBufferAttribute(posAttr, c);

    nA.fromBufferAttribute(normAttr, a);
    nB.fromBufferAttribute(normAttr, b);
    nC.fromBufferAttribute(normAttr, c);

    uvA.fromBufferAttribute(uvAttr, a);
    uvB.fromBufferAttribute(uvAttr, b);
    uvC.fromBufferAttribute(uvAttr, c);

    const hA = heightAttribute.getX(a);
    const hB = heightAttribute.getX(b);
    const hC = heightAttribute.getX(c);

    vA.addScaledVector(nA, hA);
    vB.addScaledVector(nB, hB);
    vC.addScaledVector(nC, hC);

    const intersection = ray.intersectTriangle(
      vA,
      vB,
      vC,
      false,
      intersectionPoint
    );

    if (intersection) {
      intersectionPointWorld.copy(intersection).applyMatrix4(matrixWorld);
      const distance = intersectionPointWorld.distanceTo(raycaster.ray.origin);

      if (
        closestIntersection === null ||
        distance < closestIntersection.distance
      ) {
        THREE.Triangle.getBarycoord(intersection, vA, vB, vC, barycentric);
        interpolatedUv
          .copy(uvA)
          .multiplyScalar(barycentric.x)
          .addScaledVector(uvB, barycentric.y)
          .addScaledVector(uvC, barycentric.z);

        if (closestIntersection === null) {
          closestIntersection = {
            point: intersectionPointWorld.clone(),
            distance: distance,
            uv: interpolatedUv.clone(),
          };
        } else {
          closestIntersection.point.copy(intersectionPointWorld);
          closestIntersection.distance = distance;
          closestIntersection.uv.copy(interpolatedUv);
        }
      }
    }
  }
  return closestIntersection;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event: PointerEvent): void {
  if (event.button === 0 || event.button === 2) {
    isPointerDown = true;
    pointerButton = event.button;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersect = intersectDisplacedMesh(raycaster, planetMesh);
    if (intersect) {
      const direction = pointerButton === 0 ? 1 : -1;
      sculptPlanet(intersect.point, direction);
    }
    lastSculptTime = clock.getElapsedTime();
  }
}

function onPointerUp(): void {
  isPointerDown = false;
  pointerButton = -1;
}

function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const currentTime = clock.getElapsedTime();
  // Ensure deltaTime is not NaN on the first frame
  if (lastTime === 0) {
    lastTime = currentTime;
  }
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  raycaster.setFromCamera(pointer, camera);
  const intersect = intersectDisplacedMesh(raycaster, planetMesh);

  if (intersect) {
    if (planetMesh) {
      // We use the fractional part of the interpolated UV to handle unwrapped values
      intersect.uv.x = THREE.MathUtils.euclideanModulo(intersect.uv.x, 1.0);
      intersect.uv.y = THREE.MathUtils.euclideanModulo(intersect.uv.y, 1.0);
      planetMesh.material.uniforms.uCursorPos.value.copy(intersect.uv);
      planetMesh.material.uniforms.uCursorActive.value = 1.0;

      // NEW: Update 3D cursor position in model space
      const localPoint = new THREE.Vector3();
      planetMesh.worldToLocal(localPoint.copy(intersect.point));
      planetMesh.material.uniforms.uCursorPos3D.value.copy(localPoint);
    }
    if (coordsDisplay) {
      const p = intersect.point;
      coordsDisplay.textContent = `X: ${p.x.toFixed(2)}\nY: ${p.y.toFixed(
        2
      )}\nZ: ${p.z.toFixed(2)}`;
    }
  } else {
    if (planetMesh) {
      planetMesh.material.uniforms.uCursorActive.value = 0.0;
    }
    if (coordsDisplay) {
      coordsDisplay.textContent = `X: --\nY: --\nZ: --`;
    }
  }

  if (isPointerDown) {
    const sculptInterval = 1 / 30;
    if (currentTime - lastSculptTime > sculptInterval) {
      if (intersect) {
        const direction = pointerButton === 0 ? 1 : -1;
        sculptPlanet(intersect.point, direction);
        lastSculptTime = currentTime;
      }
    }
  }

  // --- Animate Sun on an elliptical orbit ---
  if (sunMesh) {
    const x = SUN_A * Math.cos(sunAngle);
    const z = SUN_B * Math.sin(sunAngle);
    const r = Math.sqrt(x * x + z * z);
    const angularVelocity = SUN_K / (r * r);
    sunAngle += angularVelocity * deltaTime;
    sunMesh.position.set(x, 0, z);
    // subtle self-rotation for visual interest
    sunMesh.rotation.y += 0.0005;
  }

  if (cloudMesh) {
    cloudMesh.rotation.y += 0.0005;
    cloudMesh.rotation.x += 0.0002;
  }

  // --- Animate Moons with Realistic Physics (elliptical paths) ---
  if (moon1 && moonOrbit1) {
    const x1 = MOON1_A * Math.cos(moon1Angle);
    const z1 = MOON1_B * Math.sin(moon1Angle);
    const r1 = Math.sqrt(x1 * x1 + z1 * z1);

    // Angular velocity is inversely proportional to the square of the distance (Kepler-like)
    const angularVelocity = MOON1_K / (r1 * r1);
    moon1Angle += angularVelocity * deltaTime;

    // Set the moon's new position
    moon1.position.x = x1;
    moon1.position.z = z1;
    moon1.rotation.y += 0.004; // Moon's own rotation
  }

  if (moon2 && moonOrbit2) {
    const x2 = MOON2_A * Math.cos(moon2Angle);
    const z2 = MOON2_B * Math.sin(moon2Angle);
    const r2 = Math.sqrt(x2 * x2 + z2 * z2);

    const angularVelocity = MOON2_K / (r2 * r2);
    moon2Angle += angularVelocity * deltaTime;

    moon2.position.x = x2;
    moon2.position.z = z2;
    moon2.rotation.y += 0.002;
  }

  if (planetMesh) {
    planetMesh.material.uniforms.uTime.value = currentTime;
  }

  if (sunMesh && sunMesh.material instanceof THREE.ShaderMaterial) {
    const mat = sunMesh.material as THREE.ShaderMaterial;
    if (mat.uniforms && mat.uniforms.uTime) {
      mat.uniforms.uTime.value = currentTime;
    }
  }

  renderer.render(scene, camera);
}

init();
animate();
