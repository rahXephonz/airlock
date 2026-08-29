import type { Decision, DiscoveredTool } from '@airlock/shared';

export type Outcome =
  | 'allowed'
  | 'blocked'
  | 'confirmed'
  | 'declined'
  | 'failed'
  /** A blocked call a person released from the console, seeing the provenance. */
  | 'overridden';

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

const STORAGE_KEY = 'airlock.ledger.v1';

/** Kept small enough that restoring cannot become the slow part of a reload. */
const MAX_RESTORED = 60;

/**
 * Reads a previous session's entries back.
 *
 * Storage is unavailable outright in some embedded webviews and in private
 * windows — reading it can throw rather than return nothing — so every failure
 * here means starting empty, never breaking the page.
 */
const restore = (): LedgerEntry[] => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LedgerEntry =>
        !!e && typeof e === 'object' && typeof (e as LedgerEntry).toolName === 'string',
    );
  } catch {
    return [];
  }
};

/**
 * Append-only record of every mediated call and why it went the way it did.
 *
 * This is the part the built-in confirmation dialog has no equivalent for: its
 * reasoning is prose in a chat transcript, gone once the turn scrolls away.
 * Keeping decisions as data is what makes them reviewable after the fact
 * rather than only at the moment of the prompt.
 *
 * Which is why it survives a reload. An audit log that evaporates when someone
 * refreshes the page is prose in a transcript by another name — it just scrolls
 * away to a different gesture. It is held in `sessionStorage` rather than
 * `localStorage` deliberately: the record belongs to the session someone is
 * looking at, and a tab opened fresh should start empty rather than showing
 * decisions from a demo that ended yesterday.
 */
export class Ledger {
  private entries: LedgerEntry[] = restore();
  private listeners = new Set<() => void>();
  private seq = this.entries.length;

  append(entry: Omit<LedgerEntry, 'id' | 'at'>): LedgerEntry {
    const full: LedgerEntry = { ...entry, id: `call-${++this.seq}`, at: Date.now() };
    this.entries = [full, ...this.entries];
    this.persist();
    this.listeners.forEach((l) => l());
    return full;
  }

  /** Empties the record, for a clean run in front of an audience. */
  clear = (): void => {
    this.entries = [];
    this.seq = 0;
    this.persist();
    this.listeners.forEach((l) => l());
  };

  private persist() {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.entries.slice(0, MAX_RESTORED)),
      );
    } catch {
      // A full or unavailable store costs persistence, not the running session.
    }
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
