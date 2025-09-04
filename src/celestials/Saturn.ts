import * as THREE from "three";
import ringFragmentShader from "../shaders/ring.frag.glsl";
import ringVertexShader from "../shaders/ring.vert.glsl";
import saturnFragmentShader from "../shaders/saturn.frag.glsl";
import saturnVertexShader from "../shaders/saturn.vert.glsl";
import type { CelestialBodyConfig } from "./BaseCelestialBody";
import { BaseCelestialBody } from "./BaseCelestialBody";

export interface SaturnConfig extends CelestialBodyConfig {
  tintColor?: THREE.Color;
  tintStrength?: number;
  brightness?: number;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  ringInclination?: number;
  ringColor1?: THREE.Color;
  ringColor2?: THREE.Color;
  ringOpacity?: number;
}

export class Saturn extends BaseCelestialBody {
  private rings: THREE.Mesh | null = null;
  private saturnConfig: SaturnConfig;

  constructor(config: SaturnConfig) {
    super(config);
    this.saturnConfig = config;
  }

  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(this.config.size, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTintColor: { value: this.saturnConfig.tintColor || new THREE.Color(0xffffff) },
        uTintStrength: { value: this.saturnConfig.tintStrength || 0.0 },
        uBrightness: { value: this.saturnConfig.brightness || 1.1 },
      },
      vertexShader: saturnVertexShader,
      fragmentShader: saturnFragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Create rings
    this.createRings(mesh);

    return mesh;
  }

  private createRings(parent: THREE.Mesh): void {
    const innerRadius = this.saturnConfig.ringInnerRadius || this.config.size + 2;
    const outerRadius = this.saturnConfig.ringOuterRadius || this.config.size + 7;
    const ringInclination = this.saturnConfig.ringInclination || Math.PI / 2;

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: this.saturnConfig.ringColor1 || new THREE.Color(0xf8f6f2) },
        uColor2: { value: this.saturnConfig.ringColor2 || new THREE.Color(0xe8e2d8) },
        uInner: { value: innerRadius },
        uOuter: { value: outerRadius },
        uOpacity: { value: this.saturnConfig.ringOpacity || 0.9 },
        uBandFreq: { value: 28.0 },
        uBandContrast: { value: 2.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.rings = new THREE.Mesh(geometry, material);
    this.rings.rotation.x = ringInclination;

    // Apply additional ring rotation if specified in config
    if (this.saturnConfig.ringInclination !== undefined) {
      this.rings.rotation.z = 0.35; // Keep the original tilt
    }

    parent.add(this.rings);
  }

  protected updateBodySpecifics(time: number): void {
    // Update Saturn material time uniform
    if (this.mesh && this.mesh.material instanceof THREE.ShaderMaterial) {
      const material = this.mesh.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = time;
      }
    }

    // Update rings time uniform
    if (this.rings && this.rings.material instanceof THREE.ShaderMaterial) {
      const ringMaterial = this.rings.material as THREE.ShaderMaterial;
      if (ringMaterial.uniforms && ringMaterial.uniforms.uTime) {
        ringMaterial.uniforms.uTime.value = time;
      }
    }
  }

  /**
   * Update Saturn appearance properties
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

  /**
   * Update ring properties
   */
  public setRingColors(color1: THREE.Color, color2: THREE.Color): void {
    if (this.rings && this.rings.material instanceof THREE.ShaderMaterial) {
      const material = this.rings.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        if (material.uniforms.uColor1) {
          material.uniforms.uColor1.value = color1;
        }
        if (material.uniforms.uColor2) {
          material.uniforms.uColor2.value = color2;
        }
      }
    }
  }

  public setRingOpacity(opacity: number): void {
    if (this.rings && this.rings.material instanceof THREE.ShaderMaterial) {
      const material = this.rings.material as THREE.ShaderMaterial;
      if (material.uniforms && material.uniforms.uOpacity) {
        material.uniforms.uOpacity.value = opacity;
      }
    }
  }

  /**
   * Get the rings mesh for external access
   */
  public getRings(): THREE.Mesh | null {
    return this.rings;
  }

  public dispose(): void {
    super.dispose();

    if (this.rings) {
      this.rings.geometry.dispose();
      if (this.rings.material instanceof THREE.Material) {
        this.rings.material.dispose();
      }
    }
  }
}
