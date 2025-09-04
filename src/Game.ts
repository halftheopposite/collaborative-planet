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
  ORBIT_ROTATE_SPEED_FAR,
  ORBIT_ROTATE_SPEED_NEAR,
  SCULPT_RATE_HZ,
} from "./constants";
import { createEarth, type Earth } from "./earth/earth";
import { createActionLayer, type ActionLayer } from "./net/actionLayer";
import {
  loadCameraFromLocalStorage,
  loadHeightsFromLocalStorage,
  saveCameraToLocalStorage,
  saveHeightsToLocalStorage,
} from "./utils/persistence";

export class Game {
  // Core Three.js components
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private clock!: THREE.Clock;

  // Game objects
  private earth: Earth | null = null;
  private actionLayer: ActionLayer | null = null;

  // Input state
  private isPointerDown: boolean = false;
  private pointerButton: number = -1;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private lastSculptTime: number = 0;
  private isSculpting: boolean = false;
  private sculptDirection: 1 | -1 = 1; // 1 = raise, -1 = lower

  // Timing
  private lastTime = 0;

  // Save timers
  private saveTimer: number | null = null;
  private camSaveTimer: number | null = null;

  // Animation frame ID for cleanup
  private animationFrameId: number | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupControls();
    this.setupLighting();
    this.setupGameObjects();
    this.setupPersistence();
    this.setupEventListeners();
  }

  private setupScene(): void {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
  }

  private setupCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    this.camera.position.set(0, 0, CAMERA_START_Z);
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);
    // Default cursor indicates draggable canvas
    this.renderer.domElement.style.cursor = "grab";
  }

  private setupControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = CONTROLS_MIN_DISTANCE;
    this.controls.maxDistance = CONTROLS_MAX_DISTANCE;
    this.controls.enablePan = false;
    // Standard controls: left-drag orbit, wheel/middle to dolly
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.updateControlSpeeds();
  }

  private setupLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  }

  private setupGameObjects(): void {
    // Create Earth
    this.earth = createEarth();
    this.earth.create(this.scene);
    this.scene.add(this.earth.mesh);

    // Create celestials
    createCelestials(this.scene);

    // Create action layer
    this.actionLayer = createActionLayer(this.earth);
  }

  private setupPersistence(): void {
    if (!this.earth) return;

    // Load persisted heights if available
    const saved = loadHeightsFromLocalStorage();
    if (
      saved &&
      saved.length === (this.earth.mesh.geometry.attributes.aHeight as THREE.BufferAttribute).count
    ) {
      this.earth.setHeights(saved);
    }

    // Auto-save heights with a small debounce after any sculpting change
    const scheduleSave = () => {
      if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        if (!this.earth) return;
        const heights = this.earth.getHeights();
        saveHeightsToLocalStorage(heights);
        this.saveTimer = null;
      }, 250);
    };
    this.earth.onHeightsChanged(scheduleSave);

    // Load camera state if any
    const camState = loadCameraFromLocalStorage();
    if (camState) {
      this.camera.position.set(camState.position.x, camState.position.y, camState.position.z);
      this.controls.target.set(camState.target.x, camState.target.y, camState.target.z);
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.updateControlSpeeds();
    }

    // Debounced camera autosave on controls changes
    const scheduleCamSave = () => {
      if (this.camSaveTimer !== null) window.clearTimeout(this.camSaveTimer);
      this.camSaveTimer = window.setTimeout(() => {
        saveCameraToLocalStorage({
          version: 1,
          position: {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
          },
          target: {
            x: this.controls.target.x,
            y: this.controls.target.y,
            z: this.controls.target.z,
          },
        });
        this.camSaveTimer = null;
      }, 200);
    };
    this.controls.addEventListener("change", scheduleCamSave);
  }

  private setupEventListeners(): void {
    // Window events
    window.addEventListener("resize", this.onWindowResize.bind(this));
    window.addEventListener("beforeunload", this.onBeforeUnload.bind(this));

    // Pointer events
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown.bind(this));
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp.bind(this));
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove.bind(this));
    this.renderer.domElement.addEventListener("pointerout", this.onPointerOut.bind(this));
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private updateControlSpeeds(): void {
    if (!this.controls || !this.camera) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const min = this.controls.minDistance || 0.0001;
    const max = this.controls.maxDistance || min + 1;
    const t = THREE.MathUtils.clamp((dist - min) / Math.max(1e-6, max - min), 0, 1);
    this.controls.rotateSpeed = THREE.MathUtils.lerp(
      ORBIT_ROTATE_SPEED_NEAR,
      ORBIT_ROTATE_SPEED_FAR,
      t
    );
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onPointerDown(event: PointerEvent): void {
    // Sculpt only when holding a modifier with LEFT button:
    // - Ctrl + Left: raise (up)
    // - Alt/Option + Left: lower (down)
    // Otherwise, let OrbitControls handle orbit/zoom.
    if (event.button === 0 && (event.altKey || event.ctrlKey)) {
      this.isPointerDown = true;
      this.pointerButton = event.button;
      this.isSculpting = true;
      this.sculptDirection = event.altKey ? -1 : 1; // Alt/Option lowers; Ctrl raises
      this.controls.enabled = false; // avoid rotating while sculpting

      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const intersect = this.earth?.intersect(this.raycaster) ?? null;
      if (intersect && this.earth && this.actionLayer) {
        const action: ScultAction = {
          type: "scult",
          direction: this.sculptDirection === 1 ? "up" : "down",
          position: { x: intersect.point.x, y: intersect.point.y, z: intersect.point.z },
        };
        this.actionLayer.dispatchLocal(action);
      }
      this.lastSculptTime = this.clock.getElapsedTime();
      // Sculpt cursor
      this.renderer.domElement.style.cursor = "crosshair";
    } else if (event.button === 0 || event.button === 1 || event.button === 2) {
      // Non-sculpt pointer down paths still tracked for state, but OrbitControls handles movement.
      this.isPointerDown = true;
      this.pointerButton = event.button;
      // Orbit drag cursor
      this.renderer.domElement.style.cursor = "grabbing";
    }
  }

  private onPointerUp(): void {
    this.isPointerDown = false;
    this.pointerButton = -1;
    if (this.isSculpting) {
      this.isSculpting = false;
      this.controls.enabled = true;
    }
    // Restore default cursor after drag
    this.renderer.domElement.style.cursor = "grab";
  }

  private onPointerMove(event: PointerEvent): void {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private onPointerOut(): void {
    this.earth?.setCursor(null);
    // Reset cursor when leaving canvas
    if (!this.isPointerDown) this.renderer.domElement.style.cursor = "grab";
  }

  private onBeforeUnload(): void {
    if (this.earth) saveHeightsToLocalStorage(this.earth.getHeights());
    saveCameraToLocalStorage({
      version: 1,
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      target: { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z },
    });
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    this.updateControlSpeeds();
    this.controls.update();

    const currentTime = this.clock.getElapsedTime();
    // Ensure deltaTime is not NaN on the first frame
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
    }
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersect = this.earth?.intersect(this.raycaster) ?? null;

    if (intersect) {
      this.earth?.setCursor(intersect);
    } else {
      this.earth?.setCursor(null);
    }

    if (this.isPointerDown && this.isSculpting) {
      const sculptInterval = 1 / SCULPT_RATE_HZ;
      if (currentTime - this.lastSculptTime > sculptInterval) {
        if (intersect && this.earth && this.actionLayer) {
          const action: ScultAction = {
            type: "scult",
            direction: this.sculptDirection === 1 ? "up" : "down",
            position: { x: intersect.point.x, y: intersect.point.y, z: intersect.point.z },
          };
          this.actionLayer.dispatchLocal(action);
          this.lastSculptTime = currentTime;
        }
      }
    }

    // Update celestials and earth
    updateCelestials(currentTime, deltaTime);
    this.earth?.update(currentTime, deltaTime);

    this.renderer.render(this.scene, this.camera);
  }

  public start(): void {
    this.animate();
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy(): void {
    this.stop();

    // Clean up timers
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.camSaveTimer !== null) {
      window.clearTimeout(this.camSaveTimer);
      this.camSaveTimer = null;
    }

    // Remove event listeners
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    window.removeEventListener("beforeunload", this.onBeforeUnload.bind(this));

    // Clean up renderer
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();

    // Clean up controls
    this.controls.dispose();
  }

  // Getters for accessing core components if needed
  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getEarth(): Earth | null {
    return this.earth;
  }

  public getBirdsSystem() {
    return this.earth?.getBirdsSystem() ?? null;
  }
}
