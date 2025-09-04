import * as THREE from "three";
import atmosphereVertexShader from "../shaders/atmosphere.vert.glsl";
import sunSurfaceFragmentShader from "../shaders/sun.frag.glsl";
import sunSurfaceVertexShader from "../shaders/sun.vert.glsl";
import type { CelestialBodyConfig } from "./BaseCelestialBody";
import { BaseCelestialBody } from "./BaseCelestialBody";

export interface SunConfig extends CelestialBodyConfig {
  atmosphereSize?: number;
  lightIntensity?: number;
  lightDecay?: number;
  glowColor?: THREE.Color;
}

export class Sun extends BaseCelestialBody {
  private atmosphere: THREE.Mesh | null = null;
  private light: THREE.PointLight | null = null;
  private sunConfig: SunConfig;

  constructor(config: SunConfig) {
    super(config);
    this.sunConfig = config;
  }

  protected createMesh(): THREE.Mesh {
    // Create main sun geometry and material
    const geometry = new THREE.SphereGeometry(this.config.size, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: sunSurfaceVertexShader,
      fragmentShader: sunSurfaceFragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Create atmosphere
    this.createAtmosphere(mesh);

    // Create light
    this.createLight(mesh);

    return mesh;
  }

  private createAtmosphere(parent: THREE.Mesh): void {
    const atmosphereSize = this.sunConfig.atmosphereSize || this.config.size + 3;
    const glowColor = this.sunConfig.glowColor || new THREE.Color(1.0, 0.8, 0.2);

    const atmosphereGeometry = new THREE.SphereGeometry(atmosphereSize, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow( 0.7 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 1.5 );
            vec3 glowColor = vec3( ${glowColor.r}, ${glowColor.g}, ${glowColor.b} );
            gl_FragColor = vec4( glowColor, 1.0 ) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });

    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    parent.add(this.atmosphere);
  }

  private createLight(parent: THREE.Mesh): void {
    const intensity = this.sunConfig.lightIntensity || 15.0;
    const decay = this.sunConfig.lightDecay || 1.5;

    this.light = new THREE.PointLight(0xffffff, intensity, 0, decay);
    parent.add(this.light);
  }

  protected updateBodySpecifics(time: number): void {
    // Update sun material time uniform
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }
  }

  /**
   * Get the sun's light for external access
   */
  public getLight(): THREE.PointLight | null {
    return this.light;
  }

  /**
   * Update light intensity
   */
  public setLightIntensity(intensity: number): void {
    if (this.light) {
      this.light.intensity = intensity;
    }
  }

  public dispose(): void {
    super.dispose();

    if (this.atmosphere) {
      this.atmosphere.geometry.dispose();
      if (this.atmosphere.material instanceof THREE.Material) {
        this.atmosphere.material.dispose();
      }
    }
  }
}
