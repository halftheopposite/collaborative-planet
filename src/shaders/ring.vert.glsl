varying vec2 vPos;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main(){
  vPos = position.xy; // local XY plane for ring geometry
  vNormal = normalize(normalMatrix * normal);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
