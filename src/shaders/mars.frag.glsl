uniform float uTime;
uniform vec3 uTintColor;
uniform float uTintStrength; // 0..1
uniform float uBrightness; // overall multiplier

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Same noise functions as moon for consistent quality
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
                        dot( random3(i + vec3(1.0,1.0,1.0) ), f - vec3(1.0,1.1,1.0) ), u.x), u.y), u.z);
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
    vec3 noisyPos = normalize(vPosition) * 3.5; // Slightly different scale for Mars
    float n = fbm3(noisyPos);
    
    // Mars-specific surface features
    float craters = smoothstep(0.0, 0.15, abs(n));
    float dustStorms = smoothstep(-0.4, -0.1, n);
    
    // Mars color palette - rusty reds and browns
    vec3 dustColor = vec3(0.8, 0.4, 0.2);        // Rust/dust color
    vec3 rockColor = vec3(0.6, 0.25, 0.1);       // Darker rocky areas  
    vec3 ironColor = vec3(0.9, 0.3, 0.1);        // Iron oxide highlands
    vec3 darkColor = vec3(0.4, 0.2, 0.1);        // Dark crater regions
    
    // Mix colors based on noise patterns (similar to moon approach)
    vec3 finalColor = mix(dustColor, rockColor, smoothstep(-0.3, 0.1, n));
    finalColor = mix(finalColor, ironColor, smoothstep(0.0, 0.4, n));
    finalColor = mix(finalColor, darkColor, craters * 0.6);
    
    // Add some polar ice caps (lighter areas near poles)
    vec3 pos = normalize(vPosition);
    float latitude = abs(pos.y);
    if (latitude > 0.85) {
        vec3 iceColor = vec3(0.9, 0.85, 0.8);
        float iceMix = smoothstep(0.85, 0.95, latitude) * 0.4;
        finalColor = mix(finalColor, iceColor, iceMix);
    }
    
    // Add subtle dust storm highlights
    finalColor += vec3(0.2, 0.1, 0.05) * dustStorms * 0.3;
    
    // Apply lighting (simple directional)
    vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
    float NdotL = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.3;
    float lighting = ambient + (1.0 - ambient) * NdotL;
    
    finalColor *= lighting;
    
    // Apply tinting and brightness (same as moon)
    finalColor = mix(finalColor, uTintColor, clamp(uTintStrength, 0.0, 1.0));
    finalColor *= uBrightness;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
