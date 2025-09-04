import * as THREE from "three";
import type { EarthConfig } from "../celestials/Earth";
import { Earth as EarthClass } from "../celestials/Earth";
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

export type Earth = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  create: (scene: THREE.Scene) => void;
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

export function createEarth(): Earth {
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

  const earth = new EarthClass(earthConfig);

  // Return interface that defers scene creation
  const returnObj = {
    mesh: null as any, // Will be set after create() is called
    create: (scene: THREE.Scene) => {
      earth.create(scene);
      // Update the mesh reference after creation
      returnObj.mesh = earth.getMesh() as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    },
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

  return returnObj;
}
