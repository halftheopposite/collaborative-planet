import type { Action, ScultAction } from "../actions";
import { applyAction } from "../actions/apply";
import type { Earth } from "../celestials/Earth";
import { LocalLoopbackTransport, type ActionTransport } from "./transport";
import type { ActionEnvelope } from "./types";

function genId(len = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class ActionLayer {
  private seq = 0;
  private clientId: string;
  constructor(
    private earth: Earth,
    private transport: ActionTransport = new LocalLoopbackTransport(),
    clientId?: string
  ) {
    this.clientId = clientId ?? genId(10);
    this.transport.onReceive((env) => this.receive(env));
    this.transport.connect();
  }

  dispatchLocal(action: Action) {
    const env = this.wrap(action);
    this.transport.send(env);
  }

  private receive(env: ActionEnvelope) {
    // Later: dedupe and ordering checks. For now, apply immediately.
    applyAction(this.earth, env.action as ScultAction);
  }

  private wrap(action: Action): ActionEnvelope<Action> {
    return {
      id: `${this.clientId}:${++this.seq}`,
      clientId: this.clientId,
      time: Date.now(),
      action,
    };
  }

  getClientId() {
    return this.clientId;
  }

  dispose() {
    this.transport.disconnect();
  }
}

export function createActionLayer(
  earth: Earth,
  transport?: ActionTransport,
  clientId?: string
): ActionLayer {
  return new ActionLayer(earth, transport, clientId);
}
