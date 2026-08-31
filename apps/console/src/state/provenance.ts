import {
  TRUST,
  findTaint,
  originNameFor,
  recordTaint,
  type OriginName,
  type TrustLevel,
} from '@airlock/shared';
import type { LedgerEntry } from './ledger';

/** Outcomes that mean the call ran, so its output existed to be carried onward. */
const RAN = new Set(['allowed', 'confirmed', 'overridden']);

export type NodeKind =
  /** An origin whose tool output an attacker can influence. */
  | 'untrusted-source'
  /** The agent itself — the only place the two origins ever meet. */
  | 'agent'
  /** A trusted read whose output turns up in the outgoing arguments. */
  | 'sensitive-read'
  /** The capability the call was heading for. */
  | 'target';

export interface ProvenanceNode {
  readonly kind: NodeKind;
  /** Origin name, or 'agent' for the bridge node. */
  readonly origin: string;
  readonly trust: TrustLevel | 'agent' | 'unknown';
  readonly toolName?: string;
  /** One line, in the console's vocabulary. */
  readonly label: string;
  /** Text observed in both this node's output and the outgoing arguments. */
  readonly fragment?: string;
  /** Set on the target node when the call never reached the capability. */
  readonly stopped: boolean;
}

export interface ProvenanceChain {
  readonly nodes: readonly ProvenanceNode[];
  /** True when Airlock refused before the capability was invoked. */
  readonly stoppedBeforeCapability: boolean;
  readonly targetOrigin: string;
  readonly targetTool: string;
}

const trustOf = (origin: string): TrustLevel | 'unknown' => {
  const name = originNameFor(origin) ?? (origin as OriginName);
  return TRUST[name as OriginName]?.trust ?? 'unknown';
};

/**
 * The path a value took to reach one mediated call, read back out of the ledger.
 *
 * Every node here is derived from what actually happened: the untrusted sources
 * are the taint matches the policy engine recorded on this decision, and the
 * trusted read is an earlier ledger entry whose own output is matched against
 * these arguments by the same substring scan the policy engine uses. Nothing is
 * staged for the picture — a chain that were assembled for display would prove
 * only that the display can be assembled.
 *
 * The agent node is the one thing not read from a call, because it is not a
 * call. It is the gap the browser's origin boundary does not cover: two origins
 * that never spoke to each other, joined by a model that read from one and wrote
 * to the other.
 */
export const chainFor = (
  entry: LedgerEntry,
  entries: readonly LedgerEntry[],
): ProvenanceChain => {
  const nodes: ProvenanceNode[] = [];
  const targetOrigin = originNameFor(entry.origin) ?? entry.origin;

  for (const match of entry.decision.taint) {
    nodes.push({
      kind: 'untrusted-source',
      origin: match.source.origin,
      trust: TRUST[match.source.origin]?.trust ?? 'unknown',
      toolName: match.source.toolName,
      label: 'untrusted provenance introduced',
      fragment: match.fragment,
      stopped: false,
    });
  }

  if (nodes.length > 0) {
    nodes.push({
      kind: 'agent',
      origin: 'agent context',
      trust: 'agent',
      label: 'values from both origins meet here',
      stopped: false,
    });
  }

  // A trusted read is only part of this chain if what it returned is in the
  // outgoing arguments. Matching is done with the policy engine's own scan so
  // the picture cannot claim a link the engine would not have found.
  const earlier = entries.filter((e) => e.at <= entry.at && e.id !== entry.id);
  const seen = new Set<string>();
  for (const candidate of earlier) {
    const origin = originNameFor(candidate.origin);
    if (!origin || !candidate.result || !RAN.has(candidate.outcome)) continue;
    if (TRUST[origin].emitsUntrustedContent) continue; // already covered above
    if (seen.has(candidate.toolName)) continue;

    const [hit] = findTaint(entry.args, [
      recordTaint(origin, candidate.toolName, candidate.result),
    ]);
    if (!hit) continue;

    seen.add(candidate.toolName);
    nodes.push({
      kind: 'sensitive-read',
      origin,
      trust: TRUST[origin].trust,
      toolName: candidate.toolName,
      label: 'trusted data read into the call',
      fragment: hit.fragment,
      stopped: false,
    });
  }

  const stopped = entry.outcome === 'blocked' || entry.outcome === 'declined';
  nodes.push({
    kind: 'target',
    origin: targetOrigin,
    trust: trustOf(entry.origin),
    toolName: entry.toolName,
    label: stopped
      ? 'blocked before the capability was invoked'
      : entry.decision.treatedAsWrite
        ? 'write performed'
        : 'read performed',
    stopped,
  });

  return {
    nodes,
    stoppedBeforeCapability: stopped,
    targetOrigin,
    targetTool: entry.toolName,
  };
};
