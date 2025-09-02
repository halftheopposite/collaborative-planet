import * as THREE from "three";
import type { ScultAction } from "../actions";
import { directionToScalar } from "../actions";
import type { Planet } from "../planet/planet";

export function applyAction(planet: Planet, action: ScultAction): void {
  switch (action.type) {
    case "scult": {
      const dir = directionToScalar(action.direction);
      planet.sculptAt(
        new THREE.Vector3(action.position.x, action.position.y, action.position.z),
        dir
      );
      break;
    }
    default:
      break;
  }
}
