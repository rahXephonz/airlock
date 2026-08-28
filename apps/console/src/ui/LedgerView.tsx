import type { LedgerEntry, Outcome } from '../state/ledger';
import { Tag, type Tone } from './primitives';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

const RAIL: Record<Outcome, string> = {
  blocked: 'border-blocked',
  allowed: 'border-trusted',
  confirmed: 'border-semi',
  declined: 'border-ink-3',
  failed: 'border-ink-3',
};

const TONE: Record<Outcome, Tone> = {
  blocked: 'bad',
  allowed: 'trusted',
  confirmed: 'semi',
  declined: 'neutral',
  failed: 'semi',
};

/**
 * Every mediated call and the reasons behind it, kept as data.
 *
 * This is what a confirmation dialog has no equivalent for: its reasoning is
 * prose in a transcript, gone once the turn scrolls away.
 */
export function LedgerView({ entries }: { entries: readonly LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-ink-3 text-sm">
        Nothing yet. Run the scenario above, or call a tool directly.
      </p>
    );
  }

  return (
    <div>
      {entries.map((e) => (
        <div key={e.id} className={`border-l-2 ${RAIL[e.outcome]} pl-4 py-2.5 my-3`}>
          <div className="flex gap-2.5 items-center flex-wrap font-mono text-[13px]">
            <span className="text-ink-3 tabular-nums">{clock(e.at)}</span>
            <span>{e.toolName}</span>
            <Tag tone={TONE[e.outcome]}>{e.outcome}</Tag>
            <span className="text-ink-3">{e.origin}</span>
          </div>

          {e.decision.reasons.map((r, i) => (
            <p key={i} className="text-ink-2 text-[13.5px] mt-1.5 max-w-[78ch]">
              {r.detail}
            </p>
          ))}

          {(e.error ?? e.result) && (
            <pre className="bg-[#0b1218] border border-seam rounded-[2px] p-3 mt-2 text-xs
                            leading-[1.55] text-ink-2 whitespace-pre-wrap break-words overflow-x-auto">
              {e.error ?? e.result?.slice(0, 600)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
