import type { Decision, DiscoveredTool } from '@airlock/shared';

export interface ConsentRequest {
  readonly id: string;
  readonly tool: DiscoveredTool;
  readonly args: unknown;
  readonly decision: Decision;
  readonly resolve: (approved: boolean) => void;
}

/**
 * Holds the one call currently waiting on the user.
 *
 * Requests queue rather than overwrite: an agent can fire several calls before
 * anyone answers, and silently dropping the earlier ones would mean approving a
 * call the user was never shown.
 */
export class ConsentQueue {
  private queue: ConsentRequest[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;

  /** Resolves once the user answers this specific request. */
  ask(tool: DiscoveredTool, args: unknown, decision: Decision): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.queue = [...this.queue, {
        id: `consent-${++this.seq}`,
        tool,
        args,
        decision,
        resolve: (approved) => {
          this.queue = this.queue.filter((r) => r.resolve !== resolve);
          this.notify();
          resolve(approved);
        },
      }];
      this.notify();
    });
  }

  current = (): ConsentRequest | undefined => this.queue[0];

  private notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ConsentRequest | undefined => this.queue[0];
}
