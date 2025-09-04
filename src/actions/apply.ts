import * as THREE from "three";
import type { ScultAction } from "../actions";
import { directionToScalar } from "../actions";
import type { Earth } from "../earth/earth";

export function applyAction(earth: Earth, action: ScultAction): void {
  switch (action.type) {
    case "scult": {
      const dir = directionToScalar(action.direction);
      earth.sculptAt(
        new THREE.Vector3(action.position.x, action.position.y, action.position.z),
        dir
      );
      break;
    }
    default:
      break;
  }
}
