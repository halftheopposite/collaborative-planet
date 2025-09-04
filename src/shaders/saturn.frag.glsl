uniform float uTime;
uniform vec3 uTintColor;
uniform float uTintStrength; // 0..1
uniform float uBrightness; // overall multiplier

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Improved noise functions for atmospheric detail
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

// Layered atmospheric noise
float fbm(vec3 st, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * noise3(st * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Turbulence function for atmospheric disturbances
float turbulence(vec3 st, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * abs(noise3(st * frequency));
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec3 pos = normalize(vPosition);
    
    // Create latitude-based banding characteristic of gas giants
    float latitude = pos.y; // -1 to 1 from south to north pole
    
    // Base atmospheric bands - Saturn has prominent equatorial bands
    float bandPattern1 = sin(latitude * 8.0) * 0.5 + 0.5;
    float bandPattern2 = sin(latitude * 16.0 + 1.5) * 0.5 + 0.5;
    float bandPattern3 = sin(latitude * 32.0 + 3.0) * 0.5 + 0.5;
    
    // Atmospheric rotation - Saturn rotates fast, creating wind patterns
    float rotation = uTime * 0.3;
    vec3 rotatedPos = vec3(
        pos.x * cos(rotation) - pos.z * sin(rotation),
        pos.y,
        pos.x * sin(rotation) + pos.z * cos(rotation)
    );
    
    // Large-scale atmospheric circulation
    float longitude = atan(rotatedPos.z, rotatedPos.x);
    float atmosphericFlow = sin(longitude * 3.0 + latitude * 2.0 + uTime * 0.4) * 0.5 + 0.5;
    
    // Multi-scale atmospheric detail
    vec3 noisePos1 = rotatedPos * 4.0 + vec3(uTime * 0.1, 0.0, 0.0);
    vec3 noisePos2 = rotatedPos * 12.0 + vec3(uTime * 0.3, latitude * 0.5, 0.0);
    vec3 noisePos3 = rotatedPos * 24.0 + vec3(uTime * 0.5, latitude * 2.0, 0.0);
    
    float largescaleNoise = fbm(noisePos1, 4);
    float mediumNoise = fbm(noisePos2, 3);
    float smallNoise = turbulence(noisePos3, 2);
    
    // Storm systems and atmospheric features
    float stormSystems = turbulence(rotatedPos * 6.0 + vec3(uTime * 0.2, 0.0, 0.0), 3);
    
    // Saturn's characteristic color palette
    vec3 poleColor = vec3(0.85, 0.78, 0.65);      // Lighter polar regions
    vec3 equatorColor1 = vec3(0.95, 0.85, 0.60);  // Bright equatorial band
    vec3 equatorColor2 = vec3(0.80, 0.70, 0.45);  // Darker equatorial band
    vec3 temperate1 = vec3(0.88, 0.75, 0.50);     // Mid-latitude bands
    vec3 temperate2 = vec3(0.75, 0.65, 0.40);     // Alternate bands
    vec3 stormColor = vec3(0.70, 0.55, 0.35);     // Storm regions
    
    // Create atmospheric layers based on latitude
    float absLat = abs(latitude);
    vec3 baseColor;
    
    // Polar regions
    if (absLat > 0.7) {
        baseColor = mix(temperate1, poleColor, (absLat - 0.7) / 0.3);
    }
    // Temperate bands
    else if (absLat > 0.3) {
        float bandMix = sin(latitude * 20.0) * 0.5 + 0.5;
        baseColor = mix(temperate2, temperate1, bandMix);
    }
    // Equatorial bands
    else {
        float equatorMix = sin(latitude * 40.0 + uTime * 0.2) * 0.5 + 0.5;
        baseColor = mix(equatorColor2, equatorColor1, equatorMix);
    }
    
    // Apply atmospheric noise and circulation
    baseColor = mix(baseColor, temperate2, largescaleNoise * 0.3);
    baseColor = mix(baseColor, stormColor, stormSystems * 0.4);
    
    // Add smaller atmospheric details
    baseColor += vec3(mediumNoise * 0.1);
    baseColor += vec3(smallNoise * 0.05);
    
    // Atmospheric flow effects
    baseColor = mix(baseColor, baseColor * 1.1, atmosphericFlow * 0.2);
    
    // Lighting effects - gas giants have soft atmospheric scattering
    vec3 lightDir = normalize(vec3(1.0, 0.3, 0.5)); // Approximate sun direction
    float lightDot = dot(vNormal, lightDir);
    float atmosScattering = 0.7 + 0.3 * max(0.0, lightDot);
    
    // Atmospheric rim lighting
    float rimEffect = 1.0 - abs(dot(vNormal, normalize(vec3(0.0, 0.0, 1.0))));
    rimEffect = pow(rimEffect, 2.0);
    baseColor += vec3(0.1, 0.08, 0.05) * rimEffect;
    
    // Apply atmospheric scattering
    vec3 finalColor = baseColor * atmosScattering;
    
    // Add subtle atmospheric glow
    finalColor += vec3(0.05, 0.04, 0.02) * (1.0 - atmosScattering);
    
    // Apply material properties
    finalColor = mix(finalColor, uTintColor, clamp(uTintStrength, 0.0, 1.0));
    finalColor *= uBrightness;
    
    // Slight desaturation for realistic gas giant appearance
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(luminance), finalColor, 0.8);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
