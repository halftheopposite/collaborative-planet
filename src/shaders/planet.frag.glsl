varying float vHeight;
varying vec2 vUv; 
varying vec3 vNormal; // Receive normal from vertex shader
varying vec3 vPosition; // Receive model-space position
uniform float uTime;
uniform vec2 uCursorPos;
uniform vec3 uCursorPos3D; // Receive 3D cursor position
uniform float uCursorActive;
uniform vec3 uBaseLavaColor;
uniform vec3 uHotLavaColor;

// Normalization bounds for vHeight
uniform float uMinHeight;
uniform float uMaxHeight;

// Optional custom layers (normalized 0..1 starts). If uUseCustomLayers > 0.5, these drive the color.
const int MAX_LAYERS = 32; // Must match host app
uniform float uUseCustomLayers; // 0.0 or 1.0
uniform int uLayerCount;
uniform float uLayerStarts[MAX_LAYERS]; // normalized [0,1]
uniform vec3  uLayerColors[MAX_LAYERS];
// Color grading
uniform float uExposure; // simple brightness multiplier in linear space
// Optional lava overlay control (normalized space)
uniform float uUseLavaNoise; // 0.0 or 1.0
uniform float uLavaMaxT;     // apply lava overlay for t in [0, uLavaMaxT]
// --- Noise functions copied from Sun Shader for Lava Effect ---
vec3 random3(vec3 st) {
    st = vec3(dot(st, vec3(127.1, 311.7, 74.7)),
              dot(st, vec3(269.5, 183.3, 246.1)),
              dot(st, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
}
float noise3(vec3 st) {
    vec3 i = floor(st);
    vec3 f = fract(st);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( dot( random3(i + vec3(0.0,0.0,0.0) ), f - vec3(0.0,0.0,0.0) ),
                        dot( random3(i + vec3(1.0,0.0,0.0) ), f - vec3(1.0,0.0,0.0) ), u.x),
                   mix( dot( random3(i + vec3(0.0,1.0,0.0) ), f - vec3(0.0,1.0,0.0) ),
                        dot( random3(i + vec3(1.0,1.0,0.0) ), f - vec3(1.0,1.0,0.0) ), u.x), u.y),
               mix(mix( dot( random3(i + vec3(0.0,0.0,1.0) ), f - vec3(0.0,0.0,1.0) ),
                        dot( random3(i + vec3(1.0,0.0,1.0) ), f - vec3(1.0,0.0,1.0) ), u.x),
                   mix( dot( random3(i + vec3(0.0,1.0,1.0) ), f - vec3(0.0,1.0,1.0) ),
                        dot( random3(i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.0,1.0) ), u.x), u.y), u.z);
}
float fbm3(vec3 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise3(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
void main() {
    // Animated lava core (Core)
    vec3 noisyPos = normalize(vPosition) * 2.5;
    noisyPos.xy += uTime * 0.15;
    float noise = fbm3(noisyPos);
    noise = clamp(noise, 0.0, 1.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 1.5);
    vec3 baseLavaColor = uBaseLavaColor;
    vec3 hotLavaColor  = uHotLavaColor;
    vec3 turbulentLava = mix(baseLavaColor, hotLavaColor, pow(noise, 2.0));
    vec3 lavaColor     = turbulentLava * (1.0 + pulse * 0.7);
    
    // Dynamic gradient layering only
    // Normalize height to 0..1 based on provided min/max
    float t = (vHeight - uMinHeight) / (uMaxHeight - uMinHeight);
    t = clamp(t, 0.0, 1.0);
    // Default to first/last color
    vec3 c = (uLayerCount > 0) ? uLayerColors[0] : vec3(1.0);
    // If only one layer, use it; else interpolate between neighbors
    for (int i = 0; i < MAX_LAYERS - 1; i++) {
        if (i < uLayerCount - 1) {
            float a = clamp(uLayerStarts[i], 0.0, 1.0);
            float b = clamp(uLayerStarts[i + 1], 0.0, 1.0);
            if (b < a) { float tmp = a; a = b; b = tmp; }
            if (t <= a) { c = uLayerColors[i]; break; }
            if (t >= b && i == uLayerCount - 2) { c = uLayerColors[i + 1]; break; }
            if (t >= a && t <= b) {
                float w = (b - a) > 1e-5 ? (t - a) / (b - a) : 0.0;
                w = smoothstep(0.0, 1.0, w);
                c = mix(uLayerColors[i], uLayerColors[i + 1], w);
                break;
            }
        }
    }
    vec3 finalColor = c;

    // Optional lava overlay near the core (lowest normalized heights)
    if (uUseLavaNoise > 0.5 && uLayerCount > 0) {
        float lavaMask = 1.0 - smoothstep(0.0, max(1e-5, uLavaMaxT), t);
        finalColor = mix(finalColor, lavaColor, clamp(lavaMask, 0.0, 1.0));
    }
    float equatorThickness = 0.005;
    vec3 equatorColor = vec3(1.0, 1.0, 1.0); 
    if (abs(vNormal.y) < equatorThickness) {
        float equatorFactor = 1.0 - abs(vNormal.y) / equatorThickness;
        finalColor = mix(finalColor, equatorColor, equatorFactor * 0.5);
    }
    if (uCursorActive > 0.5) {
        vec3 cursorColor = vec3(1.0, 1.0, 1.0);
        float cursorRadius = 3.0;
        float cursorThickness = 0.2;
        float dist = distance(vPosition, uCursorPos3D);
        if (dist > cursorRadius - cursorThickness && dist < cursorRadius + cursorThickness) {
            float fade = 1.0 - (abs(dist - cursorRadius) / cursorThickness);
            finalColor = mix(finalColor, cursorColor, smoothstep(0.0, 1.0, fade) * 0.7);
        }
    }
    // Apply simple exposure in linear space
    finalColor *= max(0.0, uExposure);
    // Encode from linear to sRGB (accurate piecewise)
    vec3 c_lin = clamp(finalColor, 0.0, 1.0);
    vec3 lo = c_lin * 12.92;
    vec3 hi = 1.055 * pow(c_lin, vec3(1.0/2.4)) - 0.055;
    vec3 c_srgb = mix(lo, hi, step(vec3(0.0031308), c_lin));
    gl_FragColor = vec4(c_srgb, 1.0);
}
