import type { Decision, DiscoveredTool } from '@airlock/shared';

export type Outcome = 'allowed' | 'blocked' | 'confirmed' | 'declined' | 'failed';

export interface LedgerEntry {
  readonly id: string;
  readonly at: number;
  readonly toolName: string;
  readonly origin: string;
  readonly args: unknown;
  readonly decision: Decision;
  readonly outcome: Outcome;
  /** Present when the call ran; truncated for display. */
  readonly result?: string;
  readonly error?: string;
}

/**
 * Append-only record of every mediated call and why it went the way it did.
 *
 * This is the part the built-in confirmation dialog has no equivalent for: its
 * reasoning is prose in a chat transcript, gone once the turn scrolls away.
 * Keeping decisions as data is what makes them reviewable after the fact
 * rather than only at the moment of the prompt.
 */
export class Ledger {
  private entries: LedgerEntry[] = [];
  private listeners = new Set<() => void>();
  private seq = 0;

  append(entry: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
    const full: LedgerEntry = { ...entry, id: `call-${++this.seq}`, at: Date.now() };
    this.entries = [full, ...this.entries];
    this.listeners.forEach((l) => l());
    return full;
  }

  list(): readonly LedgerEntry[] {
    return this.entries;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly LedgerEntry[] => this.entries;
}

export const summarise = (tool: DiscoveredTool): string =>
  `${tool.name} on ${tool.profile?.name ?? tool.raw.origin ?? 'unknown origin'}`;
