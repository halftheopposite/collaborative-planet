import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import type { ScultAction } from "./actions";
import { createBirdsSystem, type BirdsSystem } from "./birds";
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
import {
  loadCameraFromLocalStorage,
  loadHeightsFromLocalStorage,
  saveCameraToLocalStorage,
  saveHeightsToLocalStorage,
} from "./utils/persistence";

// Core Scene
let scene!: THREE.Scene;
let camera!: THREE.PerspectiveCamera;
let renderer!: THREE.WebGLRenderer;
let controls!: OrbitControls;
let clock!: THREE.Clock;

let planet: Planet | null = null;
let actionLayer: ActionLayer | null = null;
let birdsSystem: BirdsSystem | null = null;

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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

  // Initialize birds system
  birdsSystem = createBirdsSystem(scene, planet); // Load persisted heights if available
  const saved = loadHeightsFromLocalStorage();
  if (
    saved &&
    saved.length === (planet.mesh.geometry.attributes.aHeight as THREE.BufferAttribute).count
  ) {
    planet.setHeights(saved);
  }

  // Auto-save heights with a small debounce after any sculpting change
  let saveTimer: number | null = null;
  const scheduleSave = () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (!planet) return;
      const heights = planet.getHeights();
      saveHeightsToLocalStorage(heights);
      saveTimer = null;
    }, 250);
  };
  planet.onHeightsChanged(scheduleSave);
  // Also flush on unload
  window.addEventListener("beforeunload", () => {
    if (planet) saveHeightsToLocalStorage(planet.getHeights());
  });

  // Load camera state if any
  const camState = loadCameraFromLocalStorage();
  if (camState) {
    camera.position.set(camState.position.x, camState.position.y, camState.position.z);
    controls.target.set(camState.target.x, camState.target.y, camState.target.z);
    camera.updateProjectionMatrix();
    controls.update();
    updateControlSpeeds();
  }

  // Debounced camera autosave on controls changes
  let camSaveTimer: number | null = null;
  const scheduleCamSave = () => {
    if (camSaveTimer !== null) window.clearTimeout(camSaveTimer);
    camSaveTimer = window.setTimeout(() => {
      saveCameraToLocalStorage({
        version: 1,
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      });
      camSaveTimer = null;
    }, 200);
  };
  controls.addEventListener("change", scheduleCamSave);
  window.addEventListener("beforeunload", () => {
    saveCameraToLocalStorage({
      version: 1,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    });
  });

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

  // Update birds system
  if (birdsSystem) {
    birdsSystem.update(currentTime, deltaTime);
  }
  renderer.render(scene, camera);
}

init();
animate();
