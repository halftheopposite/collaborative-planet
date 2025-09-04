varying float vHeight;
varying vec2 vUv; 
varying vec3 vNormal; // Receive normal from vertex shader
varying vec3 vPosition; // Receive model-space position
uniform float uTime;
uniform vec2 uCursorPos;
uniform vec3 uCursorPos3D; // Receive 3D cursor position
uniform float uCursorActive;
// (lava uniforms removed)
// Water/foam
uniform float uWaterLevel;   // in height units relative to base radius
uniform float uFoamWidth;    // width of foam band in height units
// Wave parameters for foam calculation
uniform float uWaveAmplitude;
uniform float uWaveAmplitudeMin;
uniform float uWaveAmplitudeMax;
uniform float uWaveFrequency;
uniform float uWaveSpeed;

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
// --- Noise utilities ---
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

    // (lava overlay removed)
    // Shoreline foam: highlight where terrain height crosses water level with wave displacement.
    // Use vHeight (height offset from base radius) and render a foam band centered at uWaterLevel + wave displacement.
    {
        // Calculate wave displacement at this fragment position (same as water vertex shader)
        vec3 worldPos = vPosition; // In model space, close enough for wave calculation
        float time = uTime * uWaveSpeed;
        
        // Primary wave (larger, slower)
        vec3 wavePos1 = worldPos * uWaveFrequency + vec3(time * 0.8, 0.0, time * 0.6);
        float wave1 = sin(wavePos1.x) * cos(wavePos1.z) * uWaveAmplitude;
        
        // Secondary wave (medium, different direction)
        vec3 wavePos2 = worldPos * (uWaveFrequency * 1.5) + vec3(time * -0.5, 0.0, time * 1.2);
        float wave2 = sin(wavePos2.x + wavePos2.z) * uWaveAmplitude * 0.6;
        
        // Tertiary wave (smaller, faster)
        vec3 wavePos3 = worldPos * (uWaveFrequency * 3.0) + vec3(time * 1.5, 0.0, time * -0.8);
        float wave3 = sin(wavePos3.x * 1.3 + wavePos3.z * 0.7) * uWaveAmplitude * 0.3;
        
        // Add noise for more natural variation
        vec3 noisePos = normalize(vPosition) * 8.0 + vec3(0.0, time * 0.3, 0.0);
        float waveNoise = fbm3(noisePos) * uWaveAmplitude * 0.4;
        
        // Combine all waves
        float totalWaveHeight = wave1 + wave2 + wave3 + waveNoise;
        
        float foamCenter = uWaterLevel + totalWaveHeight;  // height where dynamic water surface sits
        float halfW = max(1e-4, 0.5 * uFoamWidth);
        // Distance of current fragment height to the dynamic water plane in height-units
        float hdist = abs(vHeight - foamCenter);
        // Soft band falloff using smoothstep; 1 at center, 0 beyond width
        float foamMask = 1.0 - smoothstep(0.0, halfW, hdist);
        // Add some breakup so foam isn't a perfect ring
        vec3 foamNoisePos = normalize(vPosition) * 10.0 + vec3(0.0, uTime * 0.1, 0.0);
        float foamNoise = fbm3(foamNoisePos);
        // Edge choppiness
        float edge = smoothstep(0.2, 1.0, foamNoise);
        foamMask *= mix(0.7, 1.0, edge);
        // Stronger foam on water side (below water level)
        float below = step(vHeight, foamCenter);
        foamMask *= mix(0.7, 1.0, below);
        // Foam color slightly tinted towards white/blue
        vec3 foamColor = vec3(0.95, 0.97, 1.0);
        // Mix additively for sparkle, then clamp
        finalColor = mix(finalColor, foamColor, clamp(foamMask, 0.0, 1.0));
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
