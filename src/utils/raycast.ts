import * as THREE from "three";

export type DisplacedIntersection = { point: THREE.Vector3; distance: number; uv: THREE.Vector2 };

export function intersectDisplacedMesh(
  raycaster: THREE.Raycaster,
  displacedMesh: THREE.Mesh | null
): DisplacedIntersection | null {
  if (!displacedMesh || !displacedMesh.geometry) return null;

  const geometry = displacedMesh.geometry as THREE.BufferGeometry;
  const matrixWorld = displacedMesh.matrixWorld;
  const positionAttribute = geometry.attributes.position;
  const heightAttribute = (geometry as any).attributes.aHeight as THREE.BufferAttribute | undefined;
  const normalAttribute = geometry.attributes.normal;
  const uvAttribute = geometry.attributes.uv;
  const index = geometry.index;

  if (!index || !positionAttribute || !heightAttribute || !normalAttribute || !uvAttribute)
    return null;

  const inverseMatrix = new THREE.Matrix4();
  const ray = new THREE.Ray();
  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3();
  const nA = new THREE.Vector3(),
    nB = new THREE.Vector3(),
    nC = new THREE.Vector3();
  const uvA = new THREE.Vector2(),
    uvB = new THREE.Vector2(),
    uvC = new THREE.Vector2();
  const intersectionPoint = new THREE.Vector3();
  const intersectionPointWorld = new THREE.Vector3();
  const barycentric = new THREE.Vector3();
  const interpolatedUv = new THREE.Vector2();

  inverseMatrix.copy(matrixWorld).invert();
  ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

  let closestIntersection: DisplacedIntersection | null = null;

  // Narrow attributes to BufferAttribute for TS helper methods
  const posAttr = positionAttribute as THREE.BufferAttribute;
  const normAttr = normalAttribute as THREE.BufferAttribute;
  const uvAttr = uvAttribute as THREE.BufferAttribute;

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    vA.fromBufferAttribute(posAttr, a);
    vB.fromBufferAttribute(posAttr, b);
    vC.fromBufferAttribute(posAttr, c);

    nA.fromBufferAttribute(normAttr, a);
    nB.fromBufferAttribute(normAttr, b);
    nC.fromBufferAttribute(normAttr, c);

    uvA.fromBufferAttribute(uvAttr, a);
    uvB.fromBufferAttribute(uvAttr, b);
    uvC.fromBufferAttribute(uvAttr, c);

    const hA = heightAttribute.getX(a);
    const hB = heightAttribute.getX(b);
    const hC = heightAttribute.getX(c);

    vA.addScaledVector(nA, hA);
    vB.addScaledVector(nB, hB);
    vC.addScaledVector(nC, hC);

    const intersection = ray.intersectTriangle(vA, vB, vC, false, intersectionPoint);

    if (intersection) {
      intersectionPointWorld.copy(intersection).applyMatrix4(matrixWorld);
      const distance = intersectionPointWorld.distanceTo(raycaster.ray.origin);

      if (closestIntersection === null || distance < closestIntersection.distance) {
        THREE.Triangle.getBarycoord(intersection, vA, vB, vC, barycentric);
        interpolatedUv
          .copy(uvA)
          .multiplyScalar(barycentric.x)
          .addScaledVector(uvB, barycentric.y)
          .addScaledVector(uvC, barycentric.z);

        closestIntersection = {
          point: intersectionPointWorld.clone(),
          distance,
          uv: interpolatedUv.clone(),
        };
      }
    }
  }
  return closestIntersection;
}
