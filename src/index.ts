import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import type { ScultAction } from "./actions";
import { create as createCelestials, update as updateCelestials } from "./celestials";
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_START_Z,
  CONTROLS_MAX_DISTANCE,
  CONTROLS_MIN_DISTANCE,
  ORBIT_PAN_SPEED_FAR,
  ORBIT_PAN_SPEED_NEAR,
  ORBIT_ROTATE_SPEED_FAR,
  ORBIT_ROTATE_SPEED_NEAR,
  SCULPT_RATE_HZ,
} from "./constants";
import { createActionLayer, type ActionLayer } from "./net/actionLayer";
import { createPlanet, type Planet } from "./planet/planet";

// Core Scene
let scene!: THREE.Scene;
let camera!: THREE.PerspectiveCamera;
let renderer!: THREE.WebGLRenderer;
let controls!: OrbitControls;
let clock!: THREE.Clock;

let planet: Planet | null = null;
let actionLayer: ActionLayer | null = null;

let isPointerDown: boolean = false;
let pointerButton: number = -1;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastSculptTime: number = 0;
let coordsDisplay: HTMLElement | null = null;
let isSculpting: boolean = false;
let sculptDirection: 1 | -1 = 1; // 1 = raise, -1 = lower

function updateControlSpeeds() {
  if (!controls || !camera) return;
  const dist = camera.position.distanceTo(controls.target);
  const min = controls.minDistance || 0.0001;
  const max = controls.maxDistance || min + 1;
  const t = THREE.MathUtils.clamp((dist - min) / Math.max(1e-6, max - min), 0, 1);
  controls.rotateSpeed = THREE.MathUtils.lerp(ORBIT_ROTATE_SPEED_NEAR, ORBIT_ROTATE_SPEED_FAR, t);
  controls.panSpeed = THREE.MathUtils.lerp(ORBIT_PAN_SPEED_NEAR, ORBIT_PAN_SPEED_FAR, t);
}

// Timekeeping
let lastTime = 0;

// Celestials handled via src/celestials

// --- Initialization ---
function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();
  coordsDisplay = document.getElementById("coords-display");
  camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(0, 0, CAMERA_START_Z);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  // Default cursor indicates draggable canvas
  renderer.domElement.style.cursor = "grab";
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = CONTROLS_MIN_DISTANCE;
  controls.maxDistance = CONTROLS_MAX_DISTANCE;
  controls.enablePan = true;
  // Standard controls: left-drag orbit, wheel/middle to dolly, right to pan
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  updateControlSpeeds();
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  planet = createPlanet();
  scene.add(planet.mesh);
  createCelestials(scene);
  actionLayer = createActionLayer(planet);

  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerout", () => {
    planet?.setCursor(null);
    // Reset cursor when leaving canvas
    if (!isPointerDown) renderer.domElement.style.cursor = "grab";
  });
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ---

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event: PointerEvent): void {
  // Sculpt only when holding a modifier with LEFT button:
  // - Ctrl + Left: raise (up)
  // - Alt/Option + Left: lower (down)
  // Otherwise, let OrbitControls handle orbit/pan/zoom.
  if (event.button === 0 && (event.altKey || event.ctrlKey)) {
    isPointerDown = true;
    pointerButton = event.button;
    isSculpting = true;
    sculptDirection = event.altKey ? -1 : 1; // Alt/Option lowers; Ctrl raises
    controls.enabled = false; // avoid rotating while sculpting

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersect = planet?.intersect(raycaster) ?? null;
    if (intersect && planet && actionLayer) {
      const action: ScultAction = {
        type: "scult",
        direction: sculptDirection === 1 ? "up" : "down",
        position: { x: intersect.point.x, y: intersect.point.y, z: intersect.point.z },
      };
      actionLayer.dispatchLocal(action);
    }
    lastSculptTime = clock.getElapsedTime();
    // Sculpt cursor
    renderer.domElement.style.cursor = "crosshair";
  } else if (event.button === 0 || event.button === 1 || event.button === 2) {
    // Non-sculpt pointer down paths still tracked for state, but OrbitControls handles movement.
    isPointerDown = true;
    pointerButton = event.button;
    // Orbit/Pan drag cursor
    renderer.domElement.style.cursor = "grabbing";
  }
}

function onPointerUp(): void {
  isPointerDown = false;
  pointerButton = -1;
  if (isSculpting) {
    isSculpting = false;
    controls.enabled = true;
  }
  // Restore default cursor after drag
  renderer.domElement.style.cursor = "grab";
}

function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function animate() {
  requestAnimationFrame(animate);
  updateControlSpeeds();
  controls.update();

  const currentTime = clock.getElapsedTime();
  // Ensure deltaTime is not NaN on the first frame
  if (lastTime === 0) {
    lastTime = currentTime;
  }
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  raycaster.setFromCamera(pointer, camera);
  const intersect = planet?.intersect(raycaster) ?? null;

  if (intersect) {
    planet?.setCursor(intersect);
    if (coordsDisplay) {
      const p = intersect.point;
      coordsDisplay.textContent = `X: ${p.x.toFixed(2)}\nY: ${p.y.toFixed(
        2
      )}\nZ: ${p.z.toFixed(2)}`;
    }
  } else {
    planet?.setCursor(null);
    if (coordsDisplay) {
      coordsDisplay.textContent = `X: --\nY: --\nZ: --`;
    }
  }

  if (isPointerDown && isSculpting) {
    const sculptInterval = 1 / SCULPT_RATE_HZ;
    if (currentTime - lastSculptTime > sculptInterval) {
      if (intersect && planet && actionLayer) {
        const action: ScultAction = {
          type: "scult",
          direction: sculptDirection === 1 ? "up" : "down",
          position: { x: intersect.point.x, y: intersect.point.y, z: intersect.point.z },
        };
        actionLayer.dispatchLocal(action);
        lastSculptTime = currentTime;
      }
    }
  }

  // Update celestials and planet
  updateCelestials(currentTime, deltaTime);
  planet?.update(currentTime);

  renderer.render(scene, camera);
}

init();
animate();
