varying vec2 vPos;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uBandFreq;
uniform float uBandContrast;
void main(){
  float r = length(vPos);
  if(r < uInner || r > uOuter){ discard; }
  float radial = clamp((r - uInner) / max(0.0001, (uOuter - uInner)), 0.0, 1.0);
  float edge = 0.06; // relative softness
  float alpha = smoothstep(0.0, edge, radial) * (1.0 - smoothstep(1.0 - edge, 1.0, radial));
  float bands = 0.5 + 0.5 * sin((radial * uBandFreq) * 6.28318530718);
  bands = pow(bands, uBandContrast);
  vec3 color = mix(uColor1, uColor2, bands);
  gl_FragColor = vec4(color, alpha * uOpacity);
}
