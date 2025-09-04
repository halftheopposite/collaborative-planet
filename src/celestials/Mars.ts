import * as THREE from "three";
import marsFragmentShader from "../shaders/mars.frag.glsl";
import marsVertexShader from "../shaders/mars.vert.glsl";
import type { CelestialBodyConfig } from "./BaseCelestialBody";
import { BaseCelestialBody } from "./BaseCelestialBody";

export interface MarsConfig extends CelestialBodyConfig {
  tintColor?: THREE.Color;
  tintStrength?: number;
  brightness?: number;
}

export class Mars extends BaseCelestialBody {
  private marsConfig: MarsConfig;

  constructor(config: MarsConfig) {
    super(config);
    this.marsConfig = config;
  }

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(this.config.size, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTintColor: { value: this.marsConfig.tintColor || new THREE.Color(0xffffff) },
        uTintStrength: { value: this.marsConfig.tintStrength || 0.0 },
        uBrightness: { value: this.marsConfig.brightness || 1.0 },
      },
      vertexShader: marsVertexShader,
      fragmentShader: marsFragmentShader,
    });

    return new THREE.Mesh(geometry, material);
  }

  protected updateBodySpecifics(time: number): void {
    // Update Mars material time uniform
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }
  }

  /**
   * Update Mars appearance properties
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
