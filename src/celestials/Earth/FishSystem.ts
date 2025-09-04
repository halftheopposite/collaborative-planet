import * as THREE from "three";
import { EARTH_RADIUS, FISH_COUNT, FISH_DEPTH_BELOW_WATER, WATER_LEVEL } from "../../constants";
import { Fish, type Ripple } from "./Fish";

export class FishSystem {
  private fish: Fish[] = [];
  private group: THREE.Group;
  private rippleGroup: THREE.Group;
  private rippleMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.rippleGroup = new THREE.Group();
    scene.add(this.group);
    scene.add(this.rippleGroup);

    this.initializeFish();
  }

  private initializeFish(): void {
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL;
    const underwaterRadius = waterSurfaceRadius - FISH_DEPTH_BELOW_WATER;

    for (let i = 0; i < FISH_COUNT; i++) {
      // Generate random position on underwater sphere
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;

      const fishPosition = new THREE.Vector3(
        underwaterRadius * Math.sin(theta) * Math.cos(phi),
        underwaterRadius * Math.sin(theta) * Math.sin(phi),
        underwaterRadius * Math.cos(theta)
      );

      // Generate random forward direction tangent to the sphere
      const surfaceNormal = fishPosition.clone().normalize();
      const randomDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      // Project random direction onto tangent plane
      const forward = randomDir
        .clone()
        .sub(surfaceNormal.clone().multiplyScalar(randomDir.dot(surfaceNormal)))
        .normalize();

      const fish = new Fish(fishPosition, forward, underwaterRadius);
      this.fish.push(fish);
      this.group.add(fish.mesh);
    }
  }

  private createRippleMesh(ripple: Ripple, progress: number): THREE.Mesh {
    const radius = ripple.maxRadius * progress;
    const opacity = 1.0 - progress; // Fade out as it expands

    const geometry = new THREE.RingGeometry(radius * 0.8, radius, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: opacity * 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, // Use additive blending for bright white effect
      depthWrite: false, // Don't write to depth buffer to avoid z-fighting
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position the ripple slightly above the water surface to avoid z-fighting
    const surfacePosition = ripple.position.clone();
    surfacePosition.normalize().multiplyScalar(EARTH_RADIUS + WATER_LEVEL + 0.05);
    mesh.position.copy(surfacePosition);

    // Orient the ring to be tangent to the sphere surface
    const normal = surfacePosition.clone().normalize();
    mesh.lookAt(surfacePosition.clone().add(normal));

    return mesh;
  }

  private updateRipples(time: number): void {
    // Clear existing ripple meshes
    this.rippleMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
      this.rippleGroup.remove(mesh);
    });
    this.rippleMeshes = [];

    // Create new ripple meshes for active ripples
    this.fish.forEach((fish) => {
      const ripple = fish.getRipple();
      if (ripple) {
        const elapsed = time - ripple.startTime;
        const progress = elapsed / ripple.duration;

        if (progress <= 1.0) {
          const rippleMesh = this.createRippleMesh(ripple, progress);
          this.rippleGroup.add(rippleMesh);
          this.rippleMeshes.push(rippleMesh);
        }
      }
    });
  }

  update(time: number, deltaTime: number): void {
    for (const fish of this.fish) {
      fish.update(time, deltaTime);
    }

    this.updateRipples(time);
  }

  dispose(): void {
    // Dispose fish
    for (const fish of this.fish) {
      fish.body.geometry.dispose();
      fish.head.geometry.dispose();
      if (Array.isArray(fish.body.material)) {
        fish.body.material.forEach((mat) => mat.dispose());
      } else {
        fish.body.material.dispose();
      }
      if (Array.isArray(fish.head.material)) {
        fish.head.material.forEach((mat) => mat.dispose());
      } else {
        fish.head.material.dispose();
      }
      this.group.remove(fish.mesh);
    }
    this.fish = [];

    // Dispose ripples
    this.rippleMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
      this.rippleGroup.remove(mesh);
    });
    this.rippleMeshes = [];
  }

  setFishCount(count: number): void {
    // Dispose current fish
    this.dispose();

    // Update fish count and reinitialize
    const oldCount = FISH_COUNT;
    // Note: We can't modify the constant directly, but we can override it locally
    // For a full implementation, you might want to make this configurable through the Earth config
    this.initializeFishWithCount(count);
  }

  private initializeFishWithCount(count: number): void {
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL;
    const underwaterRadius = waterSurfaceRadius - FISH_DEPTH_BELOW_WATER;

    for (let i = 0; i < count; i++) {
      // Generate random position on underwater sphere
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;

      const fishPosition = new THREE.Vector3(
        underwaterRadius * Math.sin(theta) * Math.cos(phi),
        underwaterRadius * Math.sin(theta) * Math.sin(phi),
        underwaterRadius * Math.cos(theta)
      );

      // Generate random forward direction tangent to the sphere
      const surfaceNormal = fishPosition.clone().normalize();
      const randomDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      // Project random direction onto tangent plane
      const forward = randomDir
        .clone()
        .sub(surfaceNormal.clone().multiplyScalar(randomDir.dot(surfaceNormal)))
        .normalize();

      const fish = new Fish(fishPosition, forward, underwaterRadius);
      this.fish.push(fish);
      this.group.add(fish.mesh);
    }
  }
}
