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
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise3(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
void main() {
    vec3 noisyPos = normalize(vPosition) * 4.0;
    float n = fbm3(noisyPos);
    float craters = smoothstep(0.0, 0.1, abs(n));
    vec3 mariaColor = vec3(0.30, 0.30, 0.34);
    vec3 highlandColor = vec3(0.8, 0.8, 0.8);
    vec3 finalColor = mix(mariaColor, highlandColor, smoothstep(-0.2, 0.2, n));
    finalColor += vec3(1.0) * craters * 0.1;
    finalColor = mix(finalColor, uTintColor, clamp(uTintStrength, 0.0, 1.0));
    finalColor *= uBrightness;
    gl_FragColor = vec4(finalColor, 1.0);
}
