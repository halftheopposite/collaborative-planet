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
    vec3 snowColor = vec3(1.0, 1.0, 1.0);
    vec3 rockColor = vec3(0.5, 0.5, 0.5);
    vec3 grassColor = vec3(0.2, 0.6, 0.25);
    vec3 dirtColor = vec3(0.45, 0.3, 0.15);
    vec3 burntOrangeColor = vec3(0.8, 0.4, 0.1);
    vec3 noisyPos = normalize(vPosition) * 2.5;
    noisyPos.xy += uTime * 0.15;
    float noise = fbm3(noisyPos);
    float pulse = 0.5 + 0.5 * sin(uTime * 1.5);
    vec3 baseLavaColor = vec3(0.9, 0.2, 0.0);
    vec3 hotLavaColor = vec3(1.0, 0.8, 0.3);
    vec3 turbulentLava = mix(baseLavaColor, hotLavaColor, pow(noise, 2.0));
    vec3 lavaColor = turbulentLava * (1.0 + pulse * 0.7);
    vec3 finalColor = lavaColor;
    finalColor = mix(finalColor, burntOrangeColor, smoothstep(-3.75, -3.0, vHeight));
    finalColor = mix(finalColor, dirtColor,        smoothstep(-3.0, -2.0, vHeight));
    finalColor = mix(finalColor, grassColor,       smoothstep(-2.0, 0.0, vHeight));
    finalColor = mix(finalColor, rockColor,        smoothstep(0.0, 2.0, vHeight));
    finalColor = mix(finalColor, snowColor,        smoothstep(2.0, 3.75, vHeight));
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
