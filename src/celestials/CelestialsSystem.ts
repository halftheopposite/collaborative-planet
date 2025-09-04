import * as THREE from "three";
import {
  MARS_A,
  MARS_B,
  MARS_K,
  MOON_A,
  MOON_B,
  MOON_K,
  SATURN_A,
  SATURN_B,
  SATURN_K,
  SUN_A,
  SUN_B,
  SUN_K,
} from "../constants";
import type { MarsConfig, MoonConfig, SaturnConfig, SunConfig } from "./bodies";
import { Mars, Moon, Saturn, Sun } from "./bodies";

export class CelestialsSystem {
  private sun: Sun | null = null;
  private moon: Moon | null = null;
  private mars: Mars | null = null;
  private saturn: Saturn | null = null;

  public create(scene: THREE.Scene): void {
    this.createStars(scene);
    this.createCelestialBodies(scene);
  }

  private createCelestialBodies(scene: THREE.Scene): void {
    // Create Sun
    const sunConfig: SunConfig = {
      size: 15,
      orbitalParams: { a: SUN_A, b: SUN_B, k: SUN_K },
      rotationSpeed: 0.0005,
      orbitColor: 0xffdd66,
      orbitOpacity: 0.25,
      lightIntensity: 15.0,
      lightDecay: 1.5,
      atmosphereSize: 18,
      glowColor: new THREE.Color(1.0, 0.8, 0.2),
    };
    this.sun = new Sun(sunConfig);
    this.sun.create(scene);

    // Create Saturn (outer orbit)
    const saturnConfig: SaturnConfig = {
      size: 5,
      orbitalParams: { a: SATURN_A, b: SATURN_B, k: SATURN_K },
      rotationSpeed: 0.004,
      orbitInclination: 0.2,
      orbitColor: 0x6688ff,
      orbitOpacity: 0.35,
      tintColor: new THREE.Color(0xffffff),
      tintStrength: 0.0,
      brightness: 1.1,
      ringInnerRadius: 7.0,
      ringOuterRadius: 12.0,
      ringInclination: Math.PI / 2,
      ringColor1: new THREE.Color(0xf8f6f2),
      ringColor2: new THREE.Color(0xe8e2d8),
      ringOpacity: 0.9,
    };
    this.saturn = new Saturn(saturnConfig);
    this.saturn.create(scene);

    // Create Mars (middle orbit)
    const marsConfig: MarsConfig = {
      size: 4.2,
      orbitalParams: { a: MARS_A, b: MARS_B, k: MARS_K },
      rotationSpeed: 0.003,
      orbitInclination: -0.1,
      orbitColor: 0xff6644,
      orbitOpacity: 0.35,
      tintColor: new THREE.Color(0xffffff),
      tintStrength: 0.0,
      brightness: 1.0,
    };
    this.mars = new Mars(marsConfig);
    this.mars.create(scene);

    // Create Moon (inner orbit)
    const moonConfig: MoonConfig = {
      size: 3.5,
      orbitalParams: { a: MOON_A, b: MOON_B, k: MOON_K },
      rotationSpeed: 0.002,
      orbitInclination: -0.3,
      orbitColor: 0x88ff88,
      orbitOpacity: 0.35,
      tintColor: new THREE.Color(0xffffff),
      tintStrength: 0.0,
      brightness: 1.0,
    };
    this.moon = new Moon(moonConfig);
    this.moon.create(scene);
  }

  private createStars(scene: THREE.Scene): void {
    const vertices: number[] = [];
    const minDistance = 600; // Minimum distance from center (outside sun's orbit)
    const maxDistance = 1500; // Maximum distance for stars

    for (let i = 0; i < 5000; i++) {
      let x, y, z, distance;

      // Generate stars outside the solar system's elliptical boundary
      do {
        x = THREE.MathUtils.randFloatSpread(2 * maxDistance);
        y = THREE.MathUtils.randFloatSpread(2 * maxDistance);
        z = THREE.MathUtils.randFloatSpread(2 * maxDistance);
        distance = Math.sqrt(x * x + y * y + z * z);
      } while (distance < minDistance || distance > maxDistance);

      vertices.push(x, y, z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0x888888, size: 0.5 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
  }

  public update(time: number, dt: number): void {
    // Update all celestial bodies
    if (this.sun) this.sun.update(time, dt);
    if (this.saturn) this.saturn.update(time, dt);
    if (this.mars) this.mars.update(time, dt);
    if (this.moon) this.moon.update(time, dt);
  }

  // Getters for external access
  public getSun(): Sun | null {
    return this.sun;
  }

  public getMoon(): Moon | null {
    return this.moon;
  }

  public getMars(): Mars | null {
    return this.mars;
  }

  public getSaturn(): Saturn | null {
    return this.saturn;
  }

  public dispose(): void {
    if (this.sun) this.sun.dispose();
    if (this.moon) this.moon.dispose();
    if (this.mars) this.mars.dispose();
    if (this.saturn) this.saturn.dispose();
  }
}
