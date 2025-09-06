import * as THREE from "three";
import {
  EARTH_RADIUS,
  FISH_FEED_SPEED,
  FISH_RIPPLE_DURATION,
  FISH_RIPPLE_MAX_RADIUS,
  FISH_SCALE,
  FISH_SPEED,
  FISH_SURFACE_DURATION,
  FISH_SURFACE_SPEED,
  WATER_LEVEL,
} from "../../constants";

export interface Ripple {
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  maxRadius: number;
}

export class Fish {
  mesh: THREE.Group;
  body!: THREE.Mesh;
  head!: THREE.Mesh;

  // Movement properties
  position: THREE.Vector3;
  forward: THREE.Vector3;
  orbitRadius: number;
  turnRate: number;

  // Surface behavior
  isSurfacing: boolean = false;
  isAtSurface: boolean = false;
  surfaceStartTime: number = 0;
  targetDepth: number;
  underwaterDepth: number;

  // Feeding behavior
  isFeeding: boolean = false;
  isEating: boolean = false; // New state for when fish reaches food
  foodTarget: THREE.Vector3 | null = null;
  feedingStartTime: number = 0;

  // Ripple effect
  currentRipple: Ripple | null = null;

  // Fade effects
  opacity: number = 0; // Start invisible
  targetOpacity: number = 1; // Target full opacity
  fadeSpeed: number = 2.0; // Fade speed (opacity units per second)
  isVisible: boolean = true;

  private tempVector1 = new THREE.Vector3();
  private tempVector2 = new THREE.Vector3();
  private tempVector3 = new THREE.Vector3();

  constructor(position: THREE.Vector3, forward: THREE.Vector3, underwaterDepth: number) {
    this.mesh = new THREE.Group();

    // Store position and forward direction
    this.position = position.clone();
    this.forward = forward.clone().normalize();
    this.underwaterDepth = underwaterDepth;
    this.targetDepth = underwaterDepth;
    this.orbitRadius = position.length(); // Distance from earth center
    this.turnRate = (Math.random() - 0.5) * 0.2; // Random turning tendency

    this.createFishGeometry();
    this.mesh.position.copy(this.position);

    // Apply random scale: 70% to 130% of base FISH_SCALE
    const randomScale = FISH_SCALE * (0.7 + Math.random() * 0.6);
    this.mesh.scale.setScalar(randomScale);

    this.updateOrientation();
  }

  private createFishGeometry(): void {
    // Body - longer grey cube (length=3, width=0.8, height=0.8)
    // This creates a clearly elongated body along the X-axis
    const bodyGeometry = new THREE.BoxGeometry(3.0, 0.8, 0.8);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0, // Start invisible
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.position.set(-0.5, 0, 0); // Center the body slightly behind origin

    // Head - shorter grey cube (length=1, width=0.8, height=0.8)
    const headGeometry = new THREE.BoxGeometry(1.0, 0.8, 0.8);
    const headMaterial = new THREE.MeshBasicMaterial({
      color: 0x707070,
      transparent: true,
      opacity: 0, // Start invisible
    });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.position.set(1.5, 0, 0); // Position head in front

    this.mesh.add(this.body);
    this.mesh.add(this.head);
  }

  update(time: number, deltaTime: number): void {
    this.updateFade(deltaTime);
    this.updateFeedingBehavior(time, deltaTime);
    this.updateSurfaceBehavior(time, deltaTime);
    this.updateMovement(deltaTime);
    this.updateRipple(time);
  }

  private updateFade(deltaTime: number): void {
    // Update opacity towards target
    if (this.opacity !== this.targetOpacity) {
      const fadeDirection = this.targetOpacity > this.opacity ? 1 : -1;
      this.opacity += fadeDirection * this.fadeSpeed * deltaTime;

      // Clamp opacity
      if (fadeDirection > 0 && this.opacity > this.targetOpacity) {
        this.opacity = this.targetOpacity;
      } else if (fadeDirection < 0 && this.opacity < this.targetOpacity) {
        this.opacity = this.targetOpacity;
      }

      // Update material opacity
      const bodyMaterial = this.body.material as THREE.MeshBasicMaterial;
      const headMaterial = this.head.material as THREE.MeshBasicMaterial;
      bodyMaterial.opacity = this.opacity;
      headMaterial.opacity = this.opacity;

      // Hide mesh completely when fully transparent
      this.mesh.visible = this.opacity > 0.01;
    }
  }

  private updateFeedingBehavior(time: number, deltaTime: number): void {
    if ((this.isFeeding || this.isEating) && this.foodTarget) {
      const distanceToFood = this.position.distanceTo(this.foodTarget);
      const feedingDuration = time - this.feedingStartTime;

      if (this.isFeeding && distanceToFood < 2.0) {
        // Fish reached food - switch to eating state
        this.isFeeding = false;
        this.isEating = true;
      }

      // Stop eating if food duration expires (will be handled by FishSystem)
      // or if we've been trying to reach food for too long
      if (feedingDuration > 15.0) {
        this.isFeeding = false;
        this.isEating = false;
        this.foodTarget = null;
        this.feedingStartTime = 0;
      }
    }
  }

  public startFeeding(foodPosition: THREE.Vector3, currentTime: number): void {
    this.isFeeding = true;
    this.foodTarget = foodPosition.clone();
    this.feedingStartTime = currentTime;

    // Stop any current surface behavior
    this.isSurfacing = false;
    this.isAtSurface = false;
  }

  public stopFeeding(): void {
    this.isFeeding = false;
    this.isEating = false;
    this.foodTarget = null;
    this.feedingStartTime = 0;
  }

  public isCurrentlyFeeding(): boolean {
    return this.isFeeding || this.isEating;
  }

  public isCurrentlyEating(): boolean {
    return this.isEating;
  }

  public fadeIn(): void {
    this.targetOpacity = 1.0;
    this.isVisible = true;
  }

  public fadeOut(): void {
    this.targetOpacity = 0.0;
  }

  public isFullyFaded(): boolean {
    return this.opacity <= 0.01 && this.targetOpacity <= 0.01;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.targetOpacity = visible ? 1.0 : 0.0;
  }

  private updateSurfaceBehavior(time: number, deltaTime: number): void {
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL;

    if (!this.isSurfacing && !this.isAtSurface) {
      // Check if fish should start surfacing
      if (Math.random() < 0.005) {
        // 0.5% chance per frame
        this.isSurfacing = true;
        this.targetDepth = waterSurfaceRadius;
      }
    } else if (this.isSurfacing) {
      // Moving towards surface
      const currentRadius = this.position.length();
      if (currentRadius >= waterSurfaceRadius - 0.1) {
        // Reached surface
        this.isSurfacing = false;
        this.isAtSurface = true;
        this.surfaceStartTime = time;
        this.createRipple(time);
      }
    } else if (this.isAtSurface) {
      // At surface, check if time to go back down
      if (time - this.surfaceStartTime > FISH_SURFACE_DURATION) {
        this.isAtSurface = false;
        this.targetDepth = this.underwaterDepth;
      }
    }
  }

  private createRipple(time: number): void {
    this.currentRipple = {
      position: this.position.clone(),
      startTime: time,
      duration: FISH_RIPPLE_DURATION,
      maxRadius: FISH_RIPPLE_MAX_RADIUS,
    };
  }

  private updateRipple(time: number): void {
    if (this.currentRipple) {
      const elapsed = time - this.currentRipple.startTime;
      if (elapsed > this.currentRipple.duration) {
        this.currentRipple = null;
      }
    }
  }

  private updateMovement(deltaTime: number): void {
    const up = this.tempVector1.copy(this.position).normalize(); // Earth surface normal
    const right = this.tempVector2.crossVectors(this.forward, up).normalize();

    // Different movement logic based on behavior
    if (this.isEating && this.foodTarget) {
      // EATING BEHAVIOR: Stay at food location, minimal movement
      const foodDirection = this.tempVector3.copy(this.foodTarget).sub(this.position);
      const distanceToFood = foodDirection.length();

      if (distanceToFood > 1.5) {
        // If we've drifted away, move back toward food slowly
        foodDirection.normalize();
        this.forward.lerp(foodDirection, 2.0 * deltaTime);
        this.forward.normalize();

        const speed = FISH_SPEED * 0.5; // Slow approach to food
        const moveDistance = speed * deltaTime;
        this.position.add(this.tempVector3.copy(this.forward).multiplyScalar(moveDistance));
      } else {
        // Stay near food, just gentle bobbing/circling movement
        const circleSpeed = 0.2 * deltaTime;
        this.forward.applyAxisAngle(up, circleSpeed);
        this.forward.normalize();

        const gentleMove = FISH_SPEED * 0.1 * deltaTime;
        this.position.add(this.tempVector3.copy(this.forward).multiplyScalar(gentleMove));
      }

      // Stay at water surface level for eating
      const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL + 0.5;
      this.position.normalize().multiplyScalar(waterSurfaceRadius);
    } else if (this.isFeeding && this.foodTarget) {
      // FEEDING BEHAVIOR: Swim directly toward food
      const foodDirection = this.tempVector3.copy(this.foodTarget).sub(this.position).normalize();

      // Blend current forward direction with food direction for smooth turning
      this.forward.lerp(foodDirection, 3.0 * deltaTime); // Fast turning toward food
      this.forward.normalize();

      // Swim faster when feeding
      const speed = FISH_FEED_SPEED;
      const moveDistance = speed * deltaTime;
      this.position.add(this.tempVector3.copy(this.forward).multiplyScalar(moveDistance));

      // Move toward food depth (water surface level)
      const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL + 0.5;
      this.position.normalize().multiplyScalar(waterSurfaceRadius);
    } else {
      // NORMAL BEHAVIOR: Regular swimming and surfacing
      // Add gradual turning (left/right relative to fish)
      const turnAmount = this.turnRate * deltaTime;
      this.forward.applyAxisAngle(up, turnAmount);
      this.forward.normalize();

      // Choose speed based on behavior
      const speed = this.isSurfacing || this.isAtSurface ? FISH_SURFACE_SPEED : FISH_SPEED;
      const moveDistance = speed * deltaTime;
      this.position.add(this.tempVector3.copy(this.forward).multiplyScalar(moveDistance));

      // Adjust depth based on behavior
      const currentRadius = this.position.length();
      if (this.isSurfacing || this.isAtSurface) {
        // Move towards target depth
        const targetRadius = this.targetDepth;
        const radiusDiff = targetRadius - currentRadius;
        if (Math.abs(radiusDiff) > 0.1) {
          const adjustmentSpeed = 0.5 * deltaTime;
          const newRadius = currentRadius + Math.sign(radiusDiff) * adjustmentSpeed;
          this.position.normalize().multiplyScalar(newRadius);
        } else {
          this.position.normalize().multiplyScalar(targetRadius);
        }
      } else {
        // Keep fish at underwater depth
        this.position.normalize().multiplyScalar(this.underwaterDepth);
      }
    }

    // Update mesh position first
    this.mesh.position.copy(this.position);

    // Always update orientation after movement to ensure fish faces forward direction
    this.updateOrientation();

    // Occasionally change turning tendency (only when not feeding or eating)
    if (!this.isFeeding && !this.isEating && Math.random() < 0.01) {
      // 1% chance per frame
      this.turnRate = (Math.random() - 0.5) * 0.3;
    }
  }

  private updateOrientation(): void {
    // Calculate surface normal (up direction) - points away from earth center
    const up = this.tempVector1.copy(this.position).normalize();

    // Ensure forward direction is tangent to the sphere surface
    const forward = this.tempVector2.copy(this.forward);
    forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
    this.forward.copy(forward);

    // Calculate right direction (perpendicular to both up and forward)
    const right = this.tempVector3.crossVectors(forward, up).normalize();

    // Use lookAt to orient the fish towards its forward direction
    // First, position a target point in front of the fish
    const target = this.position.clone().add(forward);

    // Use lookAt to orient the fish, with up vector as the surface normal
    this.mesh.lookAt(target);

    // Apply additional rotation to align the fish's X-axis (body length) with forward direction
    // Since lookAt aligns Z-axis with the target, we need to rotate 90 degrees around Y
    this.mesh.rotateY(-Math.PI / 2);
  }

  getRipple(): Ripple | null {
    return this.currentRipple;
  }
}
