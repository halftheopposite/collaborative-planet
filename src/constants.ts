// Shared configuration constants

export const PLANET_RADIUS = 60;
export const PLANET_SEGMENTS = 64; // segments per cube face for quad sphere
export const MAX_HEIGHT = 5;
export const MIN_HEIGHT = -3.75;
export const SCULPT_RADIUS = 3;
export const SCULPT_STRENGTH = 0.75;

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
export const ORBIT_PAN_SPEED_NEAR = 0.4;
export const ORBIT_PAN_SPEED_FAR = 1.6;

// Sculpting cadence (actions per second while dragging)
export const SCULPT_RATE_HZ = 30;

// Environment layers
// Water level is a height relative to PLANET_RADIUS (negative is below base radius)
export const WATER_LEVEL = -2.6;
// Cloud shell offset above base radius
export const CLOUD_LAYER_OFFSET = 2.5;

// Orbit parameters
export const MOON1_A = 130;
export const MOON1_B = 110;
export const MOON1_K = 3600;

export const MOON2_A = 180;
export const MOON2_B = 145;
export const MOON2_K = 4000;

export const SUN_A = 520;
export const SUN_B = 400;
export const SUN_K = 12000;
