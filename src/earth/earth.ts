import * as THREE from "three";
import type { EarthConfig } from "../celestials/Earth";
import { Earth } from "../celestials/Earth";
import {
  EARTH_RADIUS,
  EARTH_SEGMENTS,
  FOAM_WIDTH,
  MAX_HEIGHT,
  MIN_HEIGHT,
  WATER_LEVEL,
  WAVE_AMPLITUDE,
  WAVE_AMPLITUDE_MAX,
  WAVE_AMPLITUDE_MIN,
  WAVE_FREQUENCY,
  WAVE_SPEED,
} from "../constants";
import type { DisplacedIntersection } from "../utils/raycast";

// Legacy Earth type for backward compatibility
export type EarthLegacy = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  update: (time: number) => void;
  setCursor: (hit: DisplacedIntersection | null) => void;
  intersect: (raycaster: THREE.Raycaster) => DisplacedIntersection | null;
  sculptAt: (point: THREE.Vector3, direction: 1 | -1) => void;
  setLayers: (layers: Array<{ start: number; color: THREE.Color | number | string }>) => void;
  clearLayers: () => void;
  setExposure: (exposure: number) => void;
  getHeights: () => Float32Array;
  setHeights: (heights: Float32Array | number[]) => void;
  onHeightsChanged: (cb: () => void) => () => void;
};

export function createEarth(): EarthLegacy {
  const earthConfig: EarthConfig = {
    size: EARTH_RADIUS,
    segments: EARTH_SEGMENTS,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    waterLevel: WATER_LEVEL,
    foamWidth: FOAM_WIDTH,
    waveAmplitude: WAVE_AMPLITUDE,
    waveAmplitudeMin: WAVE_AMPLITUDE_MIN,
    waveAmplitudeMax: WAVE_AMPLITUDE_MAX,
    waveFrequency: WAVE_FREQUENCY,
    waveSpeed: WAVE_SPEED,
    exposure: 1.15,
    rotationSpeed: 0, // No rotation by default
  };

  const earth = new Earth(earthConfig);

  // Create the Earth but don't add to scene yet (this is done outside)
  const scene = new THREE.Scene(); // Temporary scene for creation
  earth.create(scene);

  // Return legacy-compatible interface
  return {
    mesh: earth.getMesh() as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>,
    update: (time: number) => earth.update(time),
    setCursor: (hit: DisplacedIntersection | null) => earth.setCursor(hit),
    intersect: (raycaster: THREE.Raycaster) => earth.intersect(raycaster),
    sculptAt: (point: THREE.Vector3, direction: 1 | -1) => earth.sculptAt(point, direction),
    setLayers: (layers: Array<{ start: number; color: THREE.Color | number | string }>) =>
      earth.setLayers(layers),
    clearLayers: () => earth.clearLayers(),
    setExposure: (exposure: number) => earth.setExposure(exposure),
    getHeights: () => earth.getHeights(),
    setHeights: (heights: Float32Array | number[]) => earth.setHeights(heights),
    onHeightsChanged: (cb: () => void) => earth.onHeightsChanged(cb),
  };
}

// Export the standalone Earth class for new usage
export { Earth as EarthClass };
export type { EarthConfig };

// Keep the original Earth type export for compatibility
export type { EarthLegacy as Earth };
