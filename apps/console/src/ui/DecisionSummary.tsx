import { originNameFor } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { Button, LABEL, Tag, toneForDisposition } from './primitives';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

const WORD = { block: 'BLOCKED', confirm: 'CONFIRMED', allow: 'ALLOWED' } as const;

/**
 * The most recent decision, at the weight it deserves.
 *
 * A blocked call is the single most important thing this product has to say, so
 * it is a first-class surface rather than a row in a log: what was attempted,
 * where the provenance came from, and — the line the whole thesis rests on —
 * whether the capability was invoked at all.
 */
export function DecisionSummary({
  entry,
  onInspect,
  onReplay,
}: {
  entry: LedgerEntry;
  onInspect: () => void;
  onReplay: () => void;
}) {
  const blocked = entry.outcome === 'blocked';
  const disposition = entry.decision.disposition;
  const target = originNameFor(entry.origin) ?? entry.origin;
  const source = entry.decision.taint[0]?.source;
  const rule = entry.decision.reasons[0]?.code ?? '—';

  const facts: [string, string][] = [
    ['Source', source?.origin ?? 'no tracked provenance'],
    ['Target', target],
    ['Policy', rule],
    ['Provenance', source?.toolName ?? '—'],
    ['Capability invoked', blocked ? 'NO' : 'yes'],
  ];

  return (
    <section
      className={[
        'border rounded-[3px] bg-panel',
        blocked ? 'border-blocked-dim border-l-[3px] border-l-blocked' : 'border-seam',
      ].join(' ')}
    >
      <div className="flex gap-3 items-center justify-between px-4 py-2.5 border-b border-seam">
        <h3 className={LABEL}>Latest decision</h3>
        <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">{clock(entry.at)}</span>
      </div>

      <div className="p-4">
        <div className="flex gap-2.5 items-center flex-wrap">
          {blocked && (
            <span className="text-blocked font-mono text-[15px] leading-none" aria-hidden>
              ✕
            </span>
          )}
          <span
            className={`font-mono text-[15px] font-semibold tracking-[0.06em] ${
              blocked ? 'text-blocked' : 'text-ink'
            }`}
          >
            {WORD[disposition]}
          </span>
          <Tag tone={toneForDisposition(disposition)}>{entry.outcome}</Tag>
          <code className="font-mono text-[13px] text-ink-2 break-all">{entry.toolName}</code>
        </div>

        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-x-5 gap-y-3 mt-4 m-0">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className={LABEL}>{k}</dt>
              <dd
                className={`m-0 font-mono text-[12.5px] mt-1 break-words ${
                  k === 'Capability invoked' && blocked ? 'text-blocked' : 'text-ink'
                }`}
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {blocked && (
          <p className="text-[13.5px] mt-4">
            <span className="text-ink">{target} never received the call.</span>{' '}
            <span className="text-ink-3">
              Refused by the policy engine before the mediated proxy reached the origin.
            </span>
          </p>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={onInspect}>Inspect decision</Button>
          <Button tone="primary" onClick={onReplay}>
            Replay policy
          </Button>
        </div>
      </div>
    </section>
  );
}
