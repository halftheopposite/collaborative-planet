varying vec2 vPos;
void main(){
  vPos = position.xy; // local XY plane for ring geometry
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
