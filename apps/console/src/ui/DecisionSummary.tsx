import { CircleX, Check, RotateCcw, ScanSearch, ShieldAlert } from 'lucide-react';
import { originNameFor } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { chainFor } from '../state/provenance';
import { ProvenancePath } from './ProvenanceChain';
import { Button, SectionTitle, Separator } from './primitives';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

const HEADLINE = {
  block: 'Blocked',
  confirm: 'Confirmed',
  allow: 'Allowed',
} as const;

/**
 * The most recent decision.
 *
 * A blocked call is the single most important thing this product has to say, so
 * it gets one surface of its own — but not a red box. The refusal is carried by
 * a mark, a thin accent and one sentence; outlining the whole card in red would
 * be loud without being clear, and would leave nothing louder for the thing
 * that actually matters, which is that the capability never ran.
 */
export function DecisionSummary({
  entry,
  entries,
  onInspect,
  onReplay,
}: {
  entry: LedgerEntry;
  entries: readonly LedgerEntry[];
  onInspect: () => void;
  onReplay: () => void;
}) {
  const blocked = entry.outcome === 'blocked';
  const target = originNameFor(entry.origin) ?? entry.origin;
  const source = entry.decision.taint[0]?.source;
  const chain = chainFor(entry, entries);

  const facts: [string, string][] = [
    ['Source', source?.origin ?? '—'],
    ['Target', target],
    ['Policy', entry.decision.reasons[0]?.code ?? '—'],
    ['Executed', blocked ? 'No' : 'Yes'],
  ];

  return (
    <section
      className={`bg-surface rounded-md ring-1 ring-line overflow-hidden ${
        blocked ? 'border-l-2 border-l-blocked' : ''
      }`}
    >
      <div className="px-5 py-3.5">
        <SectionTitle
          action={<span className="font-mono text-[11.5px] text-fg-4">{clock(entry.at)}</span>}
        >
          Latest decision
        </SectionTitle>

        <div className="flex items-center gap-2.5 mt-3">
          {blocked ? (
            <span className="grid place-items-center size-6 rounded-sm bg-blocked-tint">
              <CircleX className="size-3.5 text-blocked" aria-hidden />
            </span>
          ) : (
            <span className="grid place-items-center size-6 rounded-sm bg-trusted-tint">
              <Check className="size-3.5 text-trusted" aria-hidden />
            </span>
          )}
          <span
            className={`text-[15px] font-semibold ${blocked ? 'text-blocked' : 'text-fg'}`}
          >
            {HEADLINE[entry.decision.disposition]}
          </span>
          <span className="font-mono text-[12.5px] text-fg-2 truncate">{entry.toolName}</span>
        </div>

        <div className="mt-2.5">
          <ProvenancePath chain={chain} />
        </div>

        <p className="text-[13px] text-fg-3 mt-2.5 max-w-[64ch] leading-[1.55] m-0">
          {entry.decision.reasons[0]?.detail}
        </p>
      </div>

      <Separator />

      <div className="px-5 py-3 flex items-center justify-between gap-6 flex-wrap">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-x-8 gap-y-2 m-0 flex-1 min-w-[260px]">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] text-fg-4">{k}</dt>
              <dd
                className={`m-0 text-[12.5px] mt-0.5 ${
                  k === 'Executed' && blocked ? 'text-blocked font-medium' : 'text-fg-2'
                }`}
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-2">
          <Button size="sm" icon={ScanSearch} onClick={onInspect}>
            Inspect
          </Button>
          <Button size="sm" icon={RotateCcw} onClick={onReplay}>
            Replay
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Shown before anything has run, so the surface is never simply blank. */
export function NoDecisionYet() {
  return (
    <section className="bg-surface rounded-md ring-1 ring-line px-5 py-3.5">
      <SectionTitle>Latest decision</SectionTitle>
      <div className="flex items-center gap-3 mt-3">
        <ShieldAlert className="size-4 text-fg-4" aria-hidden />
        <p className="text-[13px] text-fg-3 m-0">
          No calls mediated yet. Run the attack demo, or call a capability from Origins.
        </p>
      </div>
    </section>
  );
}
