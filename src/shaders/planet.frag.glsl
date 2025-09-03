varying float vHeight;
varying vec2 vUv; 
varying vec3 vNormal; // Receive normal from vertex shader
varying vec3 vPosition; // Receive model-space position
uniform float uTime;
uniform vec2 uCursorPos;
uniform vec3 uCursorPos3D; // Receive 3D cursor position
uniform float uCursorActive;
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
    // Material palette
    vec3 snowColor       = vec3(1.0, 1.0, 1.0);
    vec3 greenDarkColor  = vec3(0.12, 0.35, 0.18);     // dark green mountain
    vec3 dirtColor       = vec3(0.45, 0.30, 0.15);
    vec3 sandColor       = vec3(0.85, 0.78, 0.62);
    vec3 bedrockColor    = vec3(0.30, 0.30, 0.35);

    // Animated lava core (Core)
    vec3 noisyPos = normalize(vPosition) * 2.5;
    noisyPos.xy += uTime * 0.15;
    float noise = fbm3(noisyPos);
    float pulse = 0.5 + 0.5 * sin(uTime * 1.5);
    vec3 baseLavaColor = vec3(0.90, 0.20, 0.00);
    vec3 hotLavaColor  = vec3(1.00, 0.80, 0.30);
    vec3 turbulentLava = mix(baseLavaColor, hotLavaColor, pow(noise, 2.0));
    vec3 lavaColor     = turbulentLava * (1.0 + pulse * 0.7);

    // Height thresholds (do not change MIN/MAX globally; use local ranges)
    // Range is approximately MIN_HEIGHT=-3.75 to MAX_HEIGHT=5.0
    const float H_CORE_TOP        = -3.20; // Core (lava) -> Bedrock
    const float H_BEDROCK_TOP     = -2.80; // Bedrock -> (water sits between) -> Sand
    const float H_WATER_LEVEL     = -2.60; // Water layer radius (separate mesh), for shoreline cues
    const float H_SAND_TOP        = -1.80; // Sand -> Dirt
    const float H_DIRT_TOP        = -0.40; // Dirt -> Dark green mountain
    const float H_GREEN_TOP       =  2.00; // Dark green -> Dark green with snow
    const float H_GREEN_SNOW_TOP  =  3.20; // Dark green with snow -> Snowy mountain
    const float H_SNOW_TOP        =  5.00; // up to MAX

    // Progressive smooth layering from bottom to top
    vec3 finalColor = lavaColor;                                 // Core (lava)
    finalColor = mix(finalColor, bedrockColor,    smoothstep(H_CORE_TOP,       H_BEDROCK_TOP,    vHeight)); // Bedrock

    // Sand: starts above the water level; extra boost right near shorelines
    float sandBlend = smoothstep(H_WATER_LEVEL + 0.02, H_SAND_TOP, vHeight);
    // Encourage sand right around sea level (shore factor)
    float shore = 1.0 - abs(vHeight - H_WATER_LEVEL) / 0.50; // +/- 0.5 band around water
    shore = clamp(shore, 0.0, 1.0);
    sandBlend = clamp(max(sandBlend, shore * 0.8), 0.0, 1.0);
    finalColor = mix(finalColor, sandColor, sandBlend);        // Sand

    // Dirt
    finalColor = mix(finalColor, dirtColor,       smoothstep(H_SAND_TOP,       H_DIRT_TOP,       vHeight));

    // Dark green mountain
    finalColor = mix(finalColor, greenDarkColor,  smoothstep(H_DIRT_TOP,       H_GREEN_TOP,      vHeight));

    // Dark green mountain with snow (blend into snow)
    vec3 greenSnow = mix(greenDarkColor, snowColor, smoothstep(H_GREEN_TOP, H_GREEN_SNOW_TOP, vHeight));
    finalColor = mix(finalColor, greenSnow,        smoothstep(H_GREEN_TOP,     H_GREEN_SNOW_TOP, vHeight));

    // Snowy mountain (pure snow towards the very top)
    finalColor = mix(finalColor, snowColor,       smoothstep(H_GREEN_SNOW_TOP, H_SNOW_TOP,       vHeight));
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
    gl_FragColor = vec4(finalColor, 1.0);
}
