varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vWaveHeight;

uniform float uTime;
uniform float uOpacity;

void main() {
    // Wind Waker inspired bright blue-green water color
    vec3 waterColor = vec3(0.2, 0.6, 0.8); // Bright cyan-blue like Wind Waker's ocean
    
    gl_FragColor = vec4(waterColor, uOpacity);
}
