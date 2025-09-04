attribute float aHeight;
varying float vHeight;
varying vec2 vUv; 
varying vec3 vNormal; // Pass normal to fragment shader
varying vec3 vPosition; // Pass model-space position to fragment shader
void main() {
    vUv = uv; 
    vHeight = aHeight;
    vNormal = normalize(normal); // Assign the normal
    vPosition = position; // Assign the model-space position
    vec3 displacedPosition = position + normal * aHeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
