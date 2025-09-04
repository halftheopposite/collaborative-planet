varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vWaveHeight;

uniform float uTime;
uniform float uOpacity;

void main() {
    // Simple water color
    vec3 waterColor = vec3(0.04, 0.24, 0.4); // Deep blue
    
    gl_FragColor = vec4(waterColor, uOpacity);
}
