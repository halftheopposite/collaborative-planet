import type { ActionEnvelope } from "./types";

export interface ActionTransport {
  connect(): void;
  disconnect(): void;
  send(envelope: ActionEnvelope): void;
  onReceive(handler: (envelope: ActionEnvelope) => void): void;
}

export class LocalLoopbackTransport implements ActionTransport {
  private handler: ((envelope: ActionEnvelope) => void) | null = null;
  connect(): void {}
  disconnect(): void {
    this.handler = null;
  }
  onReceive(handler: (envelope: ActionEnvelope) => void): void {
    this.handler = handler;
  }
  send(envelope: ActionEnvelope): void {
    this.handler?.(envelope);
  }
}
