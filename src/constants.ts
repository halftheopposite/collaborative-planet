// Shared configuration constants

export const PLANET_RADIUS = 60;
export const PLANET_SEGMENTS = 64; // segments per cube face for quad sphere
export const MIN_HEIGHT = -3.75;
export const MAX_HEIGHT = 3;
export const SCULPT_RADIUS = 3;
export const SCULPT_STRENGTH = 0.25;

// Camera
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;
export const CAMERA_START_Z = 150;

// Orbit controls distances
export const CONTROLS_MIN_DISTANCE = 80;
export const CONTROLS_MAX_DISTANCE = 300;

// Orbit drag speed scaling (near -> far)
export const ORBIT_ROTATE_SPEED_NEAR = 0.4;
export const ORBIT_ROTATE_SPEED_FAR = 1.6;

// Sculpting cadence (actions per second while dragging)
export const SCULPT_RATE_HZ = 30;

// Environment layers
// Water level is a height relative to PLANET_RADIUS (negative is below base radius)
export const WATER_LEVEL = -3;
// Cloud shell offset above base radius
export const CLOUD_LAYER_OFFSET = 2.5;

// Shoreline foam
// Width of the foam band around the waterline (in height units, same as MIN/MAX_HEIGHT)
export const FOAM_WIDTH = 0.35;

// Water wave parameters
export const WAVE_AMPLITUDE = 0.3; // Reduced from 0.8
export const WAVE_AMPLITUDE_MIN = 0.1;
export const WAVE_AMPLITUDE_MAX = 0.6;
export const WAVE_FREQUENCY = 0.02;
export const WAVE_SPEED = 0.5;

// Orbit parameters
// Inner orbit (used by Moon)
export const MOON_A = 130;
export const MOON_B = 110;
export const MOON_K = 3600;

// Outer orbit (used by Saturn)
export const SATURN_A = 180;
export const SATURN_B = 145;
export const SATURN_K = 4000;

export const SUN_A = 520;
export const SUN_B = 400;
export const SUN_K = 12000;

// Birds system
export const BIRD_COUNT = 50;
export const BIRD_SCALE = 0.3;
export const BIRD_HEIGHT_OFFSET = 2.5; // Height above planet surface (constant orbital height)
export const BIRD_SPEED = 2.0; // Movement speed around planet
export const BIRD_MIN_FLAP_SPEED = 10; // Minimum wing flapping speed (Hz)
export const BIRD_MAX_FLAP_SPEED = 20; // Maximum wing flapping speed (Hz)

// --- Planet material layers (normalized 0..1) ---
// Define color layers from MIN_HEIGHT (0) to MAX_HEIGHT (1). Colors can be hex strings or numbers.
export type Layer = { start: number; color: string | number };

// Defaults approximate the current procedural palette using thresholds mapped to normalized space.
// You can edit freely; add/remove entries as needed. Ensure the last entry reaches 1.0 for a terminal color.
export const PLANET_LAYERS: Layer[] = [
  { start: 0.0, color: "#4D4D59" }, // bedrock
  { start: 0.1, color: "#D9C79E" }, // sand
  { start: 0.4, color: "#c78b50" }, // dirt
  { start: 0.5, color: "#2d8844" }, // green
  { start: 0.7, color: "#1c582b" }, // dark green
  { start: 0.8, color: "#626262" }, // snow transition
  { start: 1.0, color: "#FFFFFF" }, // top snow
];
