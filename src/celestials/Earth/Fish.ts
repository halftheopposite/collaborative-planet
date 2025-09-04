import * as THREE from "three";
import {
  EARTH_RADIUS,
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

  // Ripple effect
  currentRipple: Ripple | null = null;

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
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.position.set(-0.5, 0, 0); // Center the body slightly behind origin

    // Head - shorter grey cube (length=1, width=0.8, height=0.8)
    const headGeometry = new THREE.BoxGeometry(1.0, 0.8, 0.8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0x707070 });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.position.set(1.5, 0, 0); // Position head in front

    this.mesh.add(this.body);
    this.mesh.add(this.head);
  }

  update(time: number, deltaTime: number): void {
    this.updateSurfaceBehavior(time, deltaTime);
    this.updateMovement(deltaTime);
    this.updateRipple(time);
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
    // Add gradual turning (left/right relative to fish)
    const up = this.tempVector1.copy(this.position).normalize(); // Earth surface normal
    const right = this.tempVector2.crossVectors(this.forward, up).normalize();

    // Apply turning
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

    // Update mesh position first
    this.mesh.position.copy(this.position);

    // Always update orientation after movement to ensure fish faces forward direction
    this.updateOrientation();

    // Occasionally change turning tendency
    if (Math.random() < 0.01) {
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
