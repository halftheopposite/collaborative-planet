// Shared configuration constants

export const EARTH_RADIUS = 60;
export const EARTH_SEGMENTS = 64; // segments per cube face for quad sphere
export const MIN_HEIGHT = -3.75;
export const MAX_HEIGHT = 3;
export const SCULPT_RADIUS = 3;
export const SCULPT_STRENGTH = 0.25;

// Camera
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 2000;
export const CAMERA_START_Z = 150;

// Orbit controls distances
export const CONTROLS_MIN_DISTANCE = 80;
export const CONTROLS_MAX_DISTANCE = 650;

// Orbit drag speed scaling (near -> far)
export const ORBIT_ROTATE_SPEED_NEAR = 0.4;
export const ORBIT_ROTATE_SPEED_FAR = 1.6;

// Sculpting cadence (actions per second while dragging)
export const SCULPT_RATE_HZ = 30;

// Environment layers
// Water level is a height relative to EARTH_RADIUS (negative is below base radius)
export const WATER_LEVEL = -3;
// Cloud shell offset above base radius
export const CLOUD_LAYER_OFFSET = 2;

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

// Middle orbit (used by Mars)
export const MARS_A = 180;
export const MARS_B = 145;
export const MARS_K = 4000;

// Outer orbit (used by Saturn)
export const SATURN_A = 280;
export const SATURN_B = 220;
export const SATURN_K = 6000;

export const SUN_A = 520;
export const SUN_B = 400;
export const SUN_K = 12000;

// Birds system
export const BIRD_COUNT = 50;
export const BIRD_SCALE = 0.3;
export const BIRD_HEIGHT_OFFSET = 2.5; // Height above earth surface (constant orbital height)
export const BIRD_SPEED = 2.0; // Movement speed around earth
export const BIRD_MIN_FLAP_SPEED = 10; // Minimum wing flapping speed (Hz)
export const BIRD_MAX_FLAP_SPEED = 20; // Maximum wing flapping speed (Hz)

// Fish system
export const FISH_COUNT = 100;
export const FISH_SCALE = 0.2;
export const FISH_DEPTH_BELOW_WATER = 2.0; // How deep below water level fish swim
export const FISH_SPEED = 1.5; // Movement speed underwater
export const FISH_SURFACE_SPEED = 0.8; // Speed when going to surface
export const FISH_SURFACE_CHANCE = 0.005; // Chance per frame to surface (0.5%)
export const FISH_SURFACE_DURATION = 2.0; // How long to stay at surface (seconds)
export const FISH_RIPPLE_DURATION = 1.0; // Duration of surface ripple effect (seconds)
export const FISH_RIPPLE_MAX_RADIUS = 2.0; // Maximum radius of ripple effect

// Fish feeding system
export const FOOD_ATTRACT_RADIUS = 15.0; // Radius within which fish are attracted to food
export const FOOD_DURATION = 10.0; // How long food lasts before disappearing (seconds)
export const FISH_FEED_SPEED = 4.0; // Speed when swimming toward food (faster than normal)
export const FOOD_SCALE = 0.5; // Size of food particles

// --- Earth material layers (normalized 0..1) ---
// Define color layers from MIN_HEIGHT (0) to MAX_HEIGHT (1). Colors can be hex strings or numbers.
export type Layer = { start: number; color: string | number };

// Wind Waker inspired color palette with bright, saturated cel-shaded colors
// You can edit freely; add/remove entries as needed. Ensure the last entry reaches 1.0 for a terminal color.
export const EARTH_LAYERS: Layer[] = [
  { start: 0.0, color: "#8B7355" }, // warm brown bedrock
  { start: 0.15, color: "#F4E4BC" }, // bright creamy sand
  { start: 0.35, color: "#D4B896" }, // warm tan dirt
  { start: 0.45, color: "#E8C547" }, // golden grass transition
  { start: 0.55, color: "#7CB342" }, // bright vibrant green
  { start: 0.7, color: "#4A7C59" }, // deeper forest green
  { start: 0.8, color: "#A8C8EC" }, // soft blue-white snow transition
  { start: 0.9, color: "#E8F4FD" }, // bright white with blue tint
  { start: 1.0, color: "#FFFFFF" }, // pure white peaks
];
