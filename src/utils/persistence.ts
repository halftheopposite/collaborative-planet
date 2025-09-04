// Simple persistence utilities for saving and loading the earth height map to localStorage
// We store a small JSON wrapper with metadata and a base64 encoded Float32Array payload.

const LS_KEY = "earth-heights-v1";
const LS_KEY_CAMERA = "camera-state-v1";

export type EarthHeightsPayload = {
  version: 1;
  length: number;
  // Base64 of the underlying Float32Array bytes
  data: string;
};

export function encodeHeights(heights: Float32Array): EarthHeightsPayload {
  return {
    version: 1,
    length: heights.length,
    data: base64FromArrayBuffer(heights.buffer),
  };
}

export function decodeHeights(payload: EarthHeightsPayload): Float32Array | null {
  if (!payload || payload.version !== 1 || typeof payload.length !== "number") return null;
  const buf = arrayBufferFromBase64(payload.data);
  if (!buf) return null;
  const arr = new Float32Array(buf);
  if (arr.length !== payload.length) return null;
  return arr;
}

export function saveHeightsToLocalStorage(heights: Float32Array) {
  try {
    const payload = encodeHeights(heights);
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (e) {
    // Ignore quota or serialization errors
    console.warn("Failed to save earth heights:", e);
  }
}

export function loadHeightsFromLocalStorage(): Float32Array | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as EarthHeightsPayload;
    return decodeHeights(payload);
  } catch (e) {
    console.warn("Failed to load earth heights:", e);
    return null;
  }
}

export function clearSavedHeights() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

// Camera persistence
export type CameraState = {
  version: 1;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

export function saveCameraToLocalStorage(state: CameraState) {
  try {
    localStorage.setItem(LS_KEY_CAMERA, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save camera:", e);
  }
}

export function loadCameraFromLocalStorage(): CameraState | null {
  try {
    const raw = localStorage.getItem(LS_KEY_CAMERA);
    if (!raw) return null;
    const obj = JSON.parse(raw) as CameraState;
    if (obj && obj.version === 1 && obj.position && obj.target) return obj;
    return null;
  } catch (e) {
    console.warn("Failed to load camera:", e);
    return null;
  }
}

export function clearSavedCamera() {
  try {
    localStorage.removeItem(LS_KEY_CAMERA);
  } catch {
    // ignore
  }
}

// --- helpers ---
function base64FromArrayBuffer(buffer: ArrayBufferLike): string {
  // Convert ArrayBuffer -> binary string -> base64
  let binary = "";
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const chunk = 0x8000; // 32k chunking to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  // btoa expects binary string
  return btoa(binary);
}

function arrayBufferFromBase64(base64: string): ArrayBuffer | null {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch (e) {
    return null;
  }
}
