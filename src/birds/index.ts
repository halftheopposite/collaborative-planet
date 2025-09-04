import * as THREE from "three";
import {
  BIRD_COUNT,
  BIRD_HEIGHT_OFFSET,
  BIRD_MAX_FLAP_SPEED,
  BIRD_MIN_FLAP_SPEED,
  BIRD_SCALE,
  BIRD_SPEED,
  EARTH_RADIUS,
} from "../constants";
import type { Earth } from "../earth/earth";

class Bird {
  mesh: THREE.Group;
  animationPhase: number;
  animationSpeed: number;
  leftWing!: THREE.Mesh;
  rightWing!: THREE.Mesh;

  // Movement properties
  position: THREE.Vector3;
  forward: THREE.Vector3;
  orbitRadius: number;
  turnRate: number;

  private tempVector1 = new THREE.Vector3();
  private tempVector2 = new THREE.Vector3();
  private tempVector3 = new THREE.Vector3();

  constructor(position: THREE.Vector3, forward: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.animationPhase = Math.random() * Math.PI * 2;
    this.animationSpeed =
      BIRD_MIN_FLAP_SPEED + Math.random() * (BIRD_MAX_FLAP_SPEED - BIRD_MIN_FLAP_SPEED);

    // Store position and forward direction
    this.position = position.clone();
    this.forward = forward.clone().normalize();
    this.orbitRadius = position.length(); // Distance from earth center
    this.turnRate = (Math.random() - 0.5) * 0.3; // Random turning tendency

    this.createBirdGeometry();
    this.mesh.position.copy(this.position);
    this.mesh.scale.setScalar(BIRD_SCALE);

    this.updateOrientation();
  }

  private createBirdGeometry(): void {
    // Left wing triangle - flat in XY plane (parallel to ground when oriented)
    const leftWingGeometry = new THREE.BufferGeometry();
    const leftWingVertices = new Float32Array([
      0,
      0,
      0, // wing root
      -1,
      0.5,
      0, // wing tip (forward and left)
      -0.5,
      -0.5,
      0, // wing back (backward and left)
    ]);
    leftWingGeometry.setAttribute("position", new THREE.BufferAttribute(leftWingVertices, 3));
    leftWingGeometry.computeVertexNormals();

    // Right wing triangle - flat in XY plane (parallel to ground when oriented)
    const rightWingGeometry = new THREE.BufferGeometry();
    const rightWingVertices = new Float32Array([
      0,
      0,
      0, // wing root
      0.5,
      -0.5,
      0, // wing back (backward and right)
      1,
      0.5,
      0, // wing tip (forward and right)
    ]);
    rightWingGeometry.setAttribute("position", new THREE.BufferAttribute(rightWingVertices, 3));
    rightWingGeometry.computeVertexNormals();

    // White material for birds
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });

    this.leftWing = new THREE.Mesh(leftWingGeometry, material);
    this.rightWing = new THREE.Mesh(rightWingGeometry, material);

    this.mesh.add(this.leftWing);
    this.mesh.add(this.rightWing);
  }

  update(time: number, deltaTime: number): void {
    // Animate wing flapping - rotate around Y axis (front-to-back axis)
    const wingFlap = Math.sin(time * this.animationSpeed + this.animationPhase);
    this.leftWing.rotation.y = wingFlap * 0.3; // Left wing flaps up/down
    this.rightWing.rotation.y = -wingFlap * 0.3; // Right wing flaps opposite

    // Update movement
    this.updateMovement(deltaTime);
  }

  private updateMovement(deltaTime: number): void {
    // Add gradual turning (left/right relative to bird)
    const up = this.tempVector1.copy(this.position).normalize(); // Earth surface normal
    const right = this.tempVector2.crossVectors(this.forward, up).normalize();

    // Apply turning
    const turnAmount = this.turnRate * deltaTime;
    this.forward.applyAxisAngle(up, turnAmount);
    this.forward.normalize();

    // Move forward
    const moveDistance = BIRD_SPEED * deltaTime;
    this.position.add(this.tempVector3.copy(this.forward).multiplyScalar(moveDistance));

    // Keep bird at constant distance from earth center
    this.position.normalize().multiplyScalar(this.orbitRadius);

    // Update mesh position and orientation
    this.mesh.position.copy(this.position);
    this.updateOrientation();

    // Occasionally change turning tendency
    if (Math.random() < 0.01) {
      // 1% chance per frame
      this.turnRate = (Math.random() - 0.5) * 0.5;
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

    // Create rotation matrix where:
    // - right vector is X axis (left-right)
    // - up vector is Z axis (away from earth surface)
    // - forward vector is Y axis (bird's heading)
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(right, forward, up);

    // Apply rotation to keep bird flat against earth surface
    this.mesh.setRotationFromMatrix(matrix);
  }
}

export class BirdsSystem {
  private birds: Bird[] = [];
  private group: THREE.Group;

  constructor(scene: THREE.Scene, earth: Earth) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initializeBirds(earth);
  }

  private initializeBirds(earth: Earth): void {
    for (let i = 0; i < BIRD_COUNT; i++) {
      // Generate random position on earth surface
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;

      // Calculate position at fixed orbital height
      const orbitRadius = EARTH_RADIUS + BIRD_HEIGHT_OFFSET;
      const birdPosition = new THREE.Vector3(
        orbitRadius * Math.sin(theta) * Math.cos(phi),
        orbitRadius * Math.sin(theta) * Math.sin(phi),
        orbitRadius * Math.cos(theta)
      );

      // Generate random forward direction tangent to the sphere
      const surfaceNormal = birdPosition.clone().normalize();
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

      const bird = new Bird(birdPosition, forward);
      this.birds.push(bird);
      this.group.add(bird.mesh);
    }
  }

  update(time: number, deltaTime: number): void {
    for (const bird of this.birds) {
      bird.update(time, deltaTime);
    }
  }

  dispose(): void {
    for (const bird of this.birds) {
      bird.leftWing.geometry.dispose();
      bird.rightWing.geometry.dispose();
      if (Array.isArray(bird.leftWing.material)) {
        bird.leftWing.material.forEach((mat) => mat.dispose());
      } else {
        bird.leftWing.material.dispose();
      }
      if (Array.isArray(bird.rightWing.material)) {
        bird.rightWing.material.forEach((mat) => mat.dispose());
      } else {
        bird.rightWing.material.dispose();
      }
      this.group.remove(bird.mesh);
    }
    this.birds = [];
  }
}

export function createBirdsSystem(scene: THREE.Scene, earth: Earth): BirdsSystem {
  return new BirdsSystem(scene, earth);
}
