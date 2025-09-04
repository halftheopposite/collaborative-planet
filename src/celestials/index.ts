import * as THREE from "three";
import { CelestialsSystem } from "./CelestialsSystem";

// Create a single instance of the celestials system
const celestialsSystem = new CelestialsSystem();

export function create(scene: THREE.Scene) {
  celestialsSystem.create(scene);
}

export function update(time: number, dt: number) {
  celestialsSystem.update(time, dt);
}

// Export system for external access if needed
export { celestialsSystem };
