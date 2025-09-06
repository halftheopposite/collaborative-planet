import * as THREE from "three";
import { EARTH_RADIUS, FOOD_DURATION, FOOD_SCALE, WATER_LEVEL } from "../../constants";

export class Food {
  mesh: THREE.Group; // Changed from Mesh to Group to hold multiple breadcrumbs
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  isConsumed: boolean = false;
  breadcrumbs: THREE.Mesh[] = []; // Store individual breadcrumb meshes

  constructor(position: THREE.Vector3, startTime: number) {
    this.position = position.clone();
    this.startTime = startTime;
    this.duration = FOOD_DURATION;

    // Create a group to hold multiple breadcrumb pieces
    this.mesh = new THREE.Group();

    // Position food slightly above water surface to make it visible
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL + 0.2;
    const surfacePosition = position.clone().normalize().multiplyScalar(waterSurfaceRadius);
    this.mesh.position.copy(surfacePosition);

    // Make food bob slightly on the water surface
    this.mesh.position.add(position.clone().normalize().multiplyScalar(0.1));

    // Generate 3-7 random breadcrumb pieces
    const numCrumbs = Math.floor(Math.random() * 5) + 3; // 3 to 7 pieces
    
    for (let i = 0; i < numCrumbs; i++) {
      this.createBreadcrumb();
    }
  }

  private createBreadcrumb(): void {
    // Random breadcrumb shapes and sizes
    const shapeType = Math.random();
    let geometry: THREE.BufferGeometry;
    
    // Smaller size variation (30% to 70% of base scale)
    const size = FOOD_SCALE * (0.3 + Math.random() * 0.4);
    
    if (shapeType < 0.4) {
      // Irregular sphere (most common)
      geometry = new THREE.SphereGeometry(size, 6, 4);
    } else if (shapeType < 0.7) {
      // Small box/cube pieces
      const width = size * (0.8 + Math.random() * 0.4);
      const height = size * (0.6 + Math.random() * 0.8);
      const depth = size * (0.8 + Math.random() * 0.4);
      geometry = new THREE.BoxGeometry(width, height, depth);
    } else {
      // Flattened pieces (like crushed breadcrumbs)
      const radius = size * (0.8 + Math.random() * 0.6);
      const height = size * 0.3;
      geometry = new THREE.CylinderGeometry(radius, radius * 0.8, height, 6);
    }

    // Bread-like colors with variation
    const breadColors = [
      0xDEB887, // Burlywood (light bread)
      0xD2B48C, // Tan (medium bread)
      0xCD853F, // Peru (darker bread)
      0xF5DEB3, // Wheat (light wheat bread)
      0xDAA520, // Goldenrod (golden bread)
      0xB8860B, // Dark goldenrod (toasted bread)
    ];
    
    const randomColor = breadColors[Math.floor(Math.random() * breadColors.length)];
    
    const material = new THREE.MeshBasicMaterial({
      color: randomColor,
      transparent: true,
      opacity: 0.9,
    });

    const breadcrumb = new THREE.Mesh(geometry, material);
    
    // Random position within a larger area (more spread between crumbs)
    const spread = FOOD_SCALE * 3;
    const localX = (Math.random() - 0.5) * spread;
    const localZ = (Math.random() - 0.5) * spread;
    
    // For each breadcrumb, calculate its proper height relative to the sphere surface
    // Create a local position offset from the group center
    const localOffset = new THREE.Vector3(localX, 0, localZ);
    
    // Calculate where this breadcrumb should be in world space
    const breadcrumbWorldPos = this.position.clone().add(localOffset);
    
    // Get the correct height for this position on the sphere
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL + 0.2;
    const correctSurfacePos = breadcrumbWorldPos.normalize().multiplyScalar(waterSurfaceRadius);
    
    // The group is positioned at the original drop point's surface level
    // Calculate the Y offset needed for this breadcrumb to be at the correct surface level
    const groupSurfacePos = this.position.clone().normalize().multiplyScalar(waterSurfaceRadius);
    const heightDifference = correctSurfacePos.length() - groupSurfacePos.length();
    
    breadcrumb.position.set(localX, heightDifference, localZ);
    
    // Random rotation for more natural look
    breadcrumb.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    this.breadcrumbs.push(breadcrumb);
    this.mesh.add(breadcrumb);
  }

  update(time: number): boolean {
    const elapsed = time - this.startTime;

    // Food disappears after duration or when consumed
    if (elapsed > this.duration || this.isConsumed) {
      return false; // Should be removed
    }

    // Make food bob on water surface with reduced amplitude
    const bobAmount = Math.sin(time * 2 + this.position.x) * 0.05; // Reduced from 0.1 to 0.05
    const waterSurfaceRadius = EARTH_RADIUS + WATER_LEVEL + 0.2 + bobAmount;
    const surfacePosition = this.position.clone().normalize().multiplyScalar(waterSurfaceRadius);
    this.mesh.position.copy(surfacePosition);

    // Add very gentle individual movement to each breadcrumb
    this.breadcrumbs.forEach((crumb, index) => {
      const individualBob = Math.sin(time * 1.5 + index * 0.8) * 0.02; // Reduced from 0.05 to 0.02
      crumb.position.y = individualBob; // Keep relative to group, not adding to original Y
    });

    // Fade out as it gets older
    const fadeStart = this.duration * 0.7; // Start fading at 70% of duration
    if (elapsed > fadeStart) {
      const fadeProgress = (elapsed - fadeStart) / (this.duration - fadeStart);
      const targetOpacity = 0.9 * (1 - fadeProgress);
      
      // Update opacity for all breadcrumbs
      this.breadcrumbs.forEach((crumb) => {
        const material = crumb.material as THREE.MeshBasicMaterial;
        material.opacity = targetOpacity;
      });
    }

    return true; // Keep alive
  }

  consume(): void {
    this.isConsumed = true;
  }

  getWorldPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  dispose(): void {
    // Dispose all breadcrumb geometries and materials
    this.breadcrumbs.forEach((crumb) => {
      crumb.geometry.dispose();
      if (Array.isArray(crumb.material)) {
        crumb.material.forEach((mat) => mat.dispose());
      } else {
        crumb.material.dispose();
      }
    });
    
    // Clear the breadcrumbs array
    this.breadcrumbs.length = 0;
  }
}
