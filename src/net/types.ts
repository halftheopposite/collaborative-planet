import type { Action } from "../actions";

export type ActionEnvelope<TAction = Action> = {
  id: string;
  clientId: string;
  time: number;
  action: TAction;
};
