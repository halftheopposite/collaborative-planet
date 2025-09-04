varying vec2 vPos;
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uBandFreq;
uniform float uBandContrast;
uniform float uTime;

// Simple noise for subtle variations
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main(){
    float r = length(vPos);
    if(r < uInner || r > uOuter){ discard; }
    
    // Normalize radial position (0.0 at inner edge, 1.0 at outer edge)
    float radial = clamp((r - uInner) / max(0.0001, (uOuter - uInner)), 0.0, 1.0);
    
    // Edge softening - keep original working approach
    float edge = 0.06;
    float alpha = smoothstep(0.0, edge, radial) * (1.0 - smoothstep(1.0 - edge, 1.0, radial));
    
    // Enhanced banding with Saturn-like divisions
    float baseBands = 0.5 + 0.5 * sin((radial * uBandFreq) * 6.28318530718);
    baseBands = pow(baseBands, uBandContrast);
    
    // Add Saturn ring divisions
    float ringOpacity = 1.0;
    vec3 ringColor = mix(uColor1, uColor2, baseBands);
    
    // Create distinctive ring zones
    if (radial < 0.3) {
        // C Ring - inner, more translucent
        ringOpacity = 0.7;
        ringColor = mix(ringColor, vec3(0.9, 0.92, 0.95), 0.2);
    } else if (radial >= 0.65 && radial < 0.72) {
        // Cassini Division - darker gap
        ringOpacity = 0.3;
        ringColor = mix(ringColor, vec3(0.6, 0.6, 0.7), 0.5);
    } else if (radial >= 0.72) {
        // A Ring - outer ring
        ringOpacity = 0.85;
        ringColor = mix(ringColor, vec3(0.95, 0.9, 0.85), 0.2);
    }
    // B Ring (middle section) keeps full opacity
    
    // Add subtle particle detail
    vec2 particleCoord = vec2(radial * 40.0, atan(vPos.y, vPos.x) * 15.0);
    float particleNoise = random(floor(particleCoord) + vec2(uTime * 0.1, 0.0)) * 0.2 + 0.9;
    
    // Ice sparkle effect
    float sparkle = step(0.97, random(floor(particleCoord * 8.0) + vec2(uTime * 3.0, 0.0))) * 0.3;
    ringColor += vec3(sparkle);
    
    // Basic lighting
    vec3 lightDir = normalize(vec3(1.0, 0.5, 0.5));
    float lighting = max(0.6, dot(normalize(vNormal), lightDir));
    
    // Final color and alpha
    vec3 finalColor = ringColor * lighting * particleNoise;
    float finalAlpha = alpha * ringOpacity * uOpacity;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
}
