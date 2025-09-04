import * as THREE from "three";
import moonFragmentShader from "../shaders/moon.frag.glsl";
import moonVertexShader from "../shaders/moon.vert.glsl";
import type { CelestialBodyConfig } from "./BaseCelestialBody";
import { BaseCelestialBody } from "./BaseCelestialBody";

export interface MoonConfig extends CelestialBodyConfig {
  tintColor?: THREE.Color;
  tintStrength?: number;
  brightness?: number;
}

export class Moon extends BaseCelestialBody {
  private moonConfig: MoonConfig;

  constructor(config: MoonConfig) {
    super(config);
    this.moonConfig = config;
  }

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(this.config.size, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTintColor: { value: this.moonConfig.tintColor || new THREE.Color(0xffffff) },
        uTintStrength: { value: this.moonConfig.tintStrength || 0.0 },
        uBrightness: { value: this.moonConfig.brightness || 1.0 },
      },
      vertexShader: moonVertexShader,
      fragmentShader: moonFragmentShader,
    });

    return new THREE.Mesh(geometry, material);
  }

  protected updateBodySpecifics(time: number): void {
    // Update moon material time uniform if needed
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }
  }

  /**
   * Update moon appearance properties
   */
  public setTint(color: THREE.Color, strength: number): void {
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        if (material.uniforms.uTintColor) {
          material.uniforms.uTintColor.value = color;
        }
        if (material.uniforms.uTintStrength) {
          material.uniforms.uTintStrength.value = strength;
        }
      }
    }
  }

  public setBrightness(brightness: number): void {
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uBrightness) {
        material.uniforms.uBrightness.value = brightness;
      }
    }
  }
}
