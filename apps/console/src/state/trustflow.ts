import { TRUST, originNameFor, type OriginName, type TrustLevel } from '@airlock/shared';
import type { LedgerEntry } from './ledger';

/** Outcomes that mean the call ran. */
const RAN = new Set(['allowed', 'confirmed', 'overridden']);

export type FlowStatus =
  /** Nothing has happened here yet. */
  | 'idle'
  /** A call to this origin is in flight right now. */
  | 'active'
  /** A call completed here. */
  | 'done'
  /** Untrusted content entered the session here. */
  | 'tainted'
  /** Policy refused before this capability was invoked. */
  | 'blocked'
  /** Reached in the flow, but never called. */
  | 'never';

export interface FlowNode {
  readonly id: 'bazaar' | 'agent' | 'vault' | 'airlock' | 'dispatch';
  readonly title: string;
  readonly trust: TrustLevel | 'agent' | 'engine';
  readonly status: FlowStatus;
  /** One line, in the vocabulary of what happened rather than of the UI. */
  readonly detail: string;
  readonly toolName?: string | undefined;
  /** What travels from this node to the next. */
  readonly edge?: string | undefined;
}

const newestFor = (entries: readonly LedgerEntry[], origin: OriginName) =>
  entries.find((e) => originNameFor(e.origin) === origin);

/**
 * The trust flow, as the ledger currently describes it.
 *
 * This is the page's central picture, so it is derived rather than scripted:
 * every status below is a fact about a recorded call, and the blocked state
 * appears because the policy engine refused — not because an animation reached
 * its final frame. Running the scenario twice with the vault locked produces a
 * different picture, which is the point.
 *
 * `activeTool` is the one piece of live state that is not yet in the ledger: a
 * call in flight has no entry until it settles.
 */
export const flowFor = (
  entries: readonly LedgerEntry[],
  activeTool?: string,
): readonly FlowNode[] => {
  const bazaar = newestFor(entries, 'bazaar');
  const vault = newestFor(entries, 'vault');
  const dispatch = newestFor(entries, 'dispatch');

  const bazaarRan = !!bazaar && RAN.has(bazaar.outcome);
  const vaultRan = !!vault && RAN.has(vault.outcome);
  const refused = dispatch?.outcome === 'blocked';
  const dispatchRan = !!dispatch && RAN.has(dispatch.outcome);

  const activeOn = (origin: OriginName) =>
    !!activeTool && activeTool.startsWith(origin);

  return [
    {
      id: 'bazaar',
      title: 'bazaar',
      trust: TRUST.bazaar.trust,
      status: activeOn('bazaar') ? 'active' : bazaarRan ? 'tainted' : 'idle',
      detail: activeOn('bazaar')
        ? 'reading listing…'
        : bazaarRan
          ? 'hostile content read'
          : 'seller text, attacker-controlled',
      toolName: bazaar?.toolName,
      edge: bazaarRan ? 'tainted value' : undefined,
    },
    {
      id: 'agent',
      title: 'agent context',
      trust: 'agent',
      status: bazaarRan ? 'tainted' : 'idle',
      detail: bazaarRan
        ? 'provenance: bazaar'
        : 'where values from different origins meet',
      edge: bazaarRan ? 'carried onward' : undefined,
    },
    {
      id: 'vault',
      title: 'vault',
      trust: TRUST.vault.trust,
      status: activeOn('vault') ? 'active' : vaultRan ? 'done' : 'idle',
      detail: activeOn('vault')
        ? 'reading record…'
        : vaultRan
          ? 'trusted record read'
          : 'holds the billing record',
      toolName: vault?.toolName,
      edge: vaultRan ? 'sensitive value' : undefined,
    },
    {
      id: 'airlock',
      title: 'airlock',
      trust: 'engine',
      status: activeOn('dispatch')
        ? 'active'
        : refused
          ? 'blocked'
          : dispatch
            ? 'done'
            : 'idle',
      detail: activeOn('dispatch')
        ? 'evaluating policy…'
        : refused
          ? (dispatch?.decision.reasons[0]?.code ?? 'refused')
          : dispatch
            ? (dispatch.decision.reasons[0]?.code ?? 'evaluated')
            : 'policy engine · every call passes here',
      edge: refused ? 'refused' : dispatchRan ? 'released' : undefined,
    },
    {
      id: 'dispatch',
      title: 'dispatch',
      trust: TRUST.dispatch.trust,
      status: refused ? 'never' : dispatchRan ? 'done' : 'idle',
      detail: refused
        ? 'never invoked'
        : dispatchRan
          ? 'message sent'
          : 'the only real outbound write',
      toolName: dispatch?.toolName,
    },
  ];
};
