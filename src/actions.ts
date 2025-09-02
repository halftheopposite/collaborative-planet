// Minimal action model for sculpting

export type SculptDirection = "up" | "down";

export type ScultAction = {
  type: "scult";
  direction: SculptDirection;
  position: { x: number; y: number; z: number };
};

export type Action = ScultAction;

export function directionToScalar(direction: SculptDirection): 1 | -1 {
  return direction === "up" ? 1 : -1;
}
