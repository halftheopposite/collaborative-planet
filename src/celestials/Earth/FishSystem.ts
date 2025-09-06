import * as THREE from "three";
import {
  EARTH_RADIUS,
  FISH_COUNT,
  FISH_DEPTH_BELOW_WATER,
  FOOD_ATTRACT_RADIUS,
  WATER_LEVEL,
} from "../../constants";
import { Fish, type Ripple } from "./Fish";
import { Food } from "./Food";

export class FishSystem {
  private fish: Fish[] = [];
  private group: THREE.Group;
  private rippleGroup: THREE.Group;
  private rippleMeshes: THREE.Mesh[] = [];
  private food: Food[] = [];
  private foodGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.rippleGroup = new THREE.Group();
    this.foodGroup = new THREE.Group();
    scene.add(this.group);
    scene.add(this.rippleGroup);
    scene.add(this.foodGroup);

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
      fish.fadeIn(); // Start with fade-in effect
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
    // Update fish
    for (const fish of this.fish) {
      fish.update(time, deltaTime);
    }

    // Clean up fully faded fish
    this.cleanupFadedFish();

    // Update food and manage fish feeding behavior
    this.updateFood(time);
    this.updateFeedingBehavior(time);
    this.updateRipples(time);
  }

  private updateFood(time: number): void {
    // Update all food items and remove expired ones
    for (let i = this.food.length - 1; i >= 0; i--) {
      const foodItem = this.food[i];
      const stillActive = foodItem.update(time);

      if (!stillActive) {
        // Remove expired food
        foodItem.dispose();
        this.foodGroup.remove(foodItem.mesh);
        this.food.splice(i, 1);
      }
    }
  }

  private updateFeedingBehavior(time: number): void {
    // For each food item, attract nearby fish
    for (const foodItem of this.food) {
      if (foodItem.isConsumed) continue;

      const foodPosition = foodItem.getWorldPosition();
      let fishEatingCount = 0;

      // Check all fish for proximity to this food
      for (const fish of this.fish) {
        const distanceToFood = fish.position.distanceTo(foodPosition);

        if (distanceToFood <= FOOD_ATTRACT_RADIUS && !fish.isCurrentlyFeeding()) {
          // Start feeding behavior - fish will swim toward food
          fish.startFeeding(foodPosition, time);
        } else if (fish.isCurrentlyEating() && distanceToFood < 3.0) {
          // Count fish that are actively eating this food
          fishEatingCount++;
        }
      }

      // If fish are eating the food, consume it faster
      if (fishEatingCount > 0) {
        // Reduce food duration based on number of fish eating
        const consumptionRate = fishEatingCount * 0.3; // Each fish reduces duration by 0.3 seconds per update
        foodItem.duration -= consumptionRate * (1 / 60); // Assuming 60 FPS

        if (foodItem.duration <= 0) {
          foodItem.consume();
          // Stop all fish that were eating this food
          for (const fish of this.fish) {
            if (
              fish.isCurrentlyEating() &&
              fish.foodTarget &&
              fish.foodTarget.distanceTo(foodPosition) < 3.0
            ) {
              fish.stopFeeding();
            }
          }
        }
      }
    }
  }

  public dropFood(position: THREE.Vector3, currentTime: number): void {
    const food = new Food(position, currentTime);
    this.food.push(food);
    this.foodGroup.add(food.mesh);
  }

  public addFish(position?: THREE.Vector3): void {
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL;
    const underwaterRadius = waterSurfaceRadius - FISH_DEPTH_BELOW_WATER;

    // Use provided position or generate random position
    let fishPosition: THREE.Vector3;
    if (position) {
      fishPosition = position.clone().normalize().multiplyScalar(underwaterRadius);
    } else {
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      fishPosition = new THREE.Vector3(
        underwaterRadius * Math.sin(theta) * Math.cos(phi),
        underwaterRadius * Math.sin(theta) * Math.sin(phi),
        underwaterRadius * Math.cos(theta)
      );
    }

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
    fish.fadeIn(); // Start with fade-in effect
    this.fish.push(fish);
    this.group.add(fish.mesh);
  }

  public removeFish(index: number): void {
    if (index >= 0 && index < this.fish.length) {
      const fish = this.fish[index];
      fish.fadeOut(); // Start fade-out effect
      // Fish will be actually removed when fully faded in the update loop
    }
  }

  private cleanupFadedFish(): void {
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const fish = this.fish[i];
      if (fish.isFullyFaded()) {
        // Remove from arrays and scene
        this.group.remove(fish.mesh);
        this.fish.splice(i, 1);

        // Dispose resources
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
      }
    }
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

    // Dispose food
    for (const food of this.food) {
      food.dispose();
      this.foodGroup.remove(food.mesh);
    }
    this.food = [];
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
