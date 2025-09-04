varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vWaveHeight;

uniform float uTime;
uniform float uPlanetRadius;

// Wave parameters
uniform float uWaveAmplitude;
uniform float uWaveAmplitudeMin;
uniform float uWaveAmplitudeMax;
uniform float uWaveFrequency;
uniform float uWaveSpeed;

// Noise function for wave variation
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
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // Calculate wave displacement
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    
    // Multiple wave layers for realistic ocean movement
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
    vec3 noisePos = normalize(position) * 8.0 + vec3(0.0, time * 0.3, 0.0);
    float waveNoise = fbm3(noisePos) * uWaveAmplitude * 0.4;
    
    // Combine all waves
    float totalWaveHeight = wave1 + wave2 + wave3 + waveNoise;
    vWaveHeight = totalWaveHeight;
    
    // Displace vertex along normal
    vec3 displacedPosition = position + normal * totalWaveHeight;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
