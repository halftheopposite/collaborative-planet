uniform float uTime;
uniform vec3 uTintColor;
uniform float uTintStrength; // 0..1
uniform float uBrightness; // overall multiplier
varying vec3 vPosition;
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
    for (int i = 0; i < 6; i++) {
        value += amplitude * noise3(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
void main() {
    // Saturn has a different surface pattern with bands
    vec3 noisyPos = normalize(vPosition);
    
    // Create horizontal bands characteristic of Saturn
    float bands = sin(noisyPos.y * 12.0 + uTime * 0.1) * 0.5 + 0.5;
    bands = smoothstep(0.3, 0.7, bands);
    
    // Add noise for atmospheric details
    vec3 detailPos = noisyPos * 3.0;
    detailPos.x += uTime * 0.05; // Slow atmospheric movement
    float n = fbm3(detailPos);
    
    // Saturn's characteristic yellow-brown colors
    vec3 bandColor1 = vec3(0.95, 0.85, 0.65); // Light cream
    vec3 bandColor2 = vec3(0.85, 0.75, 0.55); // Darker brown
    vec3 stormColor = vec3(0.75, 0.65, 0.45); // Storm regions
    
    // Mix colors based on bands and noise
    vec3 finalColor = mix(bandColor2, bandColor1, bands);
    finalColor = mix(finalColor, stormColor, smoothstep(0.4, 0.6, n) * 0.3);
    
    // Add some atmospheric shimmer
    float shimmer = sin(noisyPos.x * 20.0 + uTime * 0.3) * 0.1 + 0.9;
    finalColor *= shimmer;
    
    finalColor = mix(finalColor, uTintColor, clamp(uTintStrength, 0.0, 1.0));
    finalColor *= uBrightness;
    gl_FragColor = vec4(finalColor, 1.0);
}
