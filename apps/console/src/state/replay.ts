import {
  evaluate,
  recordTaint,
  type Disposition,
  type DiscoveredTool,
  type TaintSource,
} from '@airlock/shared';
import type { LedgerEntry } from './ledger';

/** Outcomes that mean the call actually ran, so its output could taint later ones. */
const RAN = new Set(['allowed', 'confirmed', 'overridden']);

export interface ReplayStep {
  readonly entry: LedgerEntry;
  /** What Airlock decided at the time. */
  readonly recorded: Disposition;
  /** What the policy engine decides now, from the stored arguments and taint. */
  readonly rederived: Disposition | undefined;
  readonly agrees: boolean;
  /** Reason codes the re-run produced, for showing where two runs diverged. */
  readonly reasons: readonly string[];
  /** Set when the step could not be re-derived, with why. */
  readonly unavailable?: string;
}

export interface ReplayReport {
  readonly steps: readonly ReplayStep[];
  readonly reproduced: number;
  readonly diverged: number;
  readonly skipped: number;
}

/**
 * Re-derives every decision in the log from the log.
 *
 * This is what makes "kept as data rather than as prose" a claim someone can
 * check rather than a slogan. A confirmation dialog's reasoning is a sentence
 * that was generated once; there is nothing to re-run and nothing to disagree
 * with. Here the arguments, the tool and the provenance were all recorded, the
 * policy engine is pure over exactly those three things, and so the decision
 * can be computed a second time and compared with what was decided the first.
 *
 * The taint chain is rebuilt as it goes rather than taken from the entries,
 * because that is the part worth proving: step three was blocked because of
 * what step one returned, and replaying step three alone would not show it.
 *
 * A step is skipped rather than failed when its tool is no longer published —
 * the vault unregisters its read tool while locked, and a surface that changed
 * since the call is a fact about the session, not a disagreement about policy.
 */
export const replay = (
  entries: readonly LedgerEntry[],
  tools: readonly DiscoveredTool[],
): ReplayReport => {
  // Nothing below reaches a resolver, and there is no parameter here that could
  // carry one. Replay evaluates policy over recorded data; the capability the
  // original call was heading for is not invoked, cannot be invoked, and the
  // absence of any execution path is the reason replaying a blocked publish is
  // safe to press in front of an audience.
  const byName = new Map(tools.map((t) => [t.name, t]));
  // The ledger is newest-first; causation runs the other way.
  const chronological = [...entries].reverse();

  let taint: TaintSource[] = [];
  const steps: ReplayStep[] = [];

  for (const entry of chronological) {
    const tool = byName.get(entry.toolName);

    if (!tool) {
      steps.push({
        entry,
        recorded: entry.decision.disposition,
        rederived: undefined,
        agrees: false,
        reasons: [],
        unavailable: `${entry.toolName} is not published right now, so its decision cannot be recomputed.`,
      });
      continue;
    }

    const decision = evaluate({ tool, args: entry.args, taintSources: taint });
    steps.push({
      entry,
      recorded: entry.decision.disposition,
      rederived: decision.disposition,
      agrees: decision.disposition === entry.decision.disposition,
      reasons: decision.reasons.map((r) => r.code),
    });

    // Only a call that ran produced output, and only an origin that emits
    // attacker-influenceable text taints what follows.
    const emits = tool.profile?.emitsUntrustedContent || tool.claimsUntrustedContent;
    if (emits && RAN.has(entry.outcome) && entry.result) {
      taint = [...taint, recordTaint(tool.profile!.name, tool.name, entry.result)];
    }
  }

  return {
    steps,
    reproduced: steps.filter((s) => s.agrees).length,
    diverged: steps.filter((s) => !s.agrees && !s.unavailable).length,
    skipped: steps.filter((s) => s.unavailable).length,
  };
};

/**
 * Re-derives one recorded decision, with the taint chain rebuilt from the calls
 * that preceded it.
 *
 * A single entry cannot be replayed on its own and mean anything: the blocked
 * write was blocked because of what an earlier read returned, so the whole log
 * up to that point is what the policy engine has to be given. This runs the same
 * reconstruction and returns the one step asked about.
 */
export const replayEntry = (
  entry: LedgerEntry,
  entries: readonly LedgerEntry[],
  tools: readonly DiscoveredTool[],
): ReplayStep | undefined =>
  replay(entries, tools).steps.find((s) => s.entry.id === entry.id);
