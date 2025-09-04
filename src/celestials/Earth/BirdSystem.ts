import * as THREE from "three";
import {
  BIRD_COUNT,
  BIRD_HEIGHT_OFFSET,
  EARTH_RADIUS,
} from "../../constants";
import { Bird } from "./Bird";

export class BirdSystem {
  private birds: Bird[] = [];
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initializeBirds();
  }

  private initializeBirds(): void {
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
