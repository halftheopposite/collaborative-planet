import * as THREE from "three";

export interface OrbitalParameters {
  a: number; // Semi-major axis
  b: number; // Semi-minor axis
  k: number; // Orbital constant for speed calculation
}

export interface CelestialBodyConfig {
  size: number;
  orbitalParams: OrbitalParameters;
  rotationSpeed: number;
  orbitInclination?: number;
  orbitColor?: number;
  orbitOpacity?: number;
}

export abstract class BaseCelestialBody {
  protected mesh: THREE.Mesh | null = null;
  protected orbit: THREE.Group | null = null;
  protected orbitLine: THREE.LineLoop | null = null;
  protected angle = 0;
  protected config: CelestialBodyConfig;

  constructor(config: CelestialBodyConfig) {
    this.config = config;
  }

  /**
   * Abstract method to create the celestial body's geometry and material
   */
  protected abstract createMesh(): THREE.Mesh;

  /**
   * Abstract method to update body-specific properties
   */
  protected abstract updateBodySpecifics(time: number): void;

  /**
   * Creates the orbit visualization
   */
  protected createOrbitLine(): THREE.LineLoop {
    const { a, b } = this.config.orbitalParams;
    const points: THREE.Vector3[] = [];
    const segments = 256;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(a * Math.cos(t), 0, b * Math.sin(t)));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.config.orbitColor || 0x666666,
      transparent: true,
      opacity: this.config.orbitOpacity || 0.3,
      depthWrite: false,
    });

    return new THREE.LineLoop(geometry, material);
  }

  /**
   * Initializes the celestial body and adds it to the scene
   */
  public create(scene: THREE.Scene): void {
    // Create the orbit group
    this.orbit = new THREE.Group();

    // Apply orbit inclination if specified
    if (this.config.orbitInclination !== undefined) {
      this.orbit.rotation.x = this.config.orbitInclination;
    }

    // Create the mesh
    this.mesh = this.createMesh();
    this.orbit.add(this.mesh);

    // Create orbit visualization
    this.orbitLine = this.createOrbitLine();
    this.orbit.add(this.orbitLine);

    // Add to scene
    scene.add(this.orbit);

    // Set initial position
    this.updatePosition(0);
  }

  /**
   * Updates the celestial body's position along its orbit
   */
  protected updatePosition(dt: number): void {
    if (!this.mesh) return;

    const { a, b, k } = this.config.orbitalParams;

    // Calculate position using Kepler's laws approximation
    const x = a * Math.cos(this.angle);
    const z = b * Math.sin(this.angle);
    const r = Math.sqrt(x * x + z * z);
    const angularVelocity = k / (r * r);

    this.angle += angularVelocity * dt;

    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y += this.config.rotationSpeed;
  }

  /**
   * Main update method called each frame
   */
  public update(time: number, dt: number): void {
    this.updatePosition(dt);
    this.updateBodySpecifics(time);
  }

  /**
   * Get the mesh for external access (e.g., for lighting)
   */
  public getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  /**
   * Get the current position of the celestial body
   */
  public getPosition(): THREE.Vector3 | null {
    return this.mesh ? this.mesh.position : null;
  }

  /**
   * Cleanup method
   */
  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      } else if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach((material) => material.dispose());
      }
    }

    if (this.orbitLine) {
      this.orbitLine.geometry.dispose();
      if (this.orbitLine.material instanceof THREE.Material) {
        this.orbitLine.material.dispose();
      }
    }
  }
}
