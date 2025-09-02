uniform float uTime;
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
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise3(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
void main() {
    vec3 noisyPos = normalize(vPosition) * 1.5; 
    noisyPos.x += uTime * 0.1; 
    float n = fbm3(noisyPos);
    vec3 color1 = vec3(0.8, 0.3, 0.0);    
    vec3 color2 = vec3(1.0, 0.7, 0.2);    
    vec3 color3 = vec3(1.0, 1.0, 0.9);    
    vec3 finalColor = mix(color1, color2, n * 2.0);
    finalColor = mix(finalColor, color3, pow(n, 2.0)); 
    finalColor *= 2.5;
    gl_FragColor = vec4(finalColor, 1.0);
}
