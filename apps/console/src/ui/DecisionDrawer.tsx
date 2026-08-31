import { useEffect, useState } from 'react';
import { Check, CircleX, RotateCcw, ShieldOff } from 'lucide-react';
import { originNameFor, type DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { chainFor } from '../state/provenance';
import { replayEntry, type ReplayStep } from '../state/replay';
import { ProvenanceChainView } from './ProvenanceChain';
import { Sheet } from './Sheet';
import { Badge, Button, Facts, SectionTitle, Separator, toneForDisposition } from './primitives';

const WORD = { block: 'BLOCK', confirm: 'CONFIRM', allow: 'ALLOW' } as const;

/**
 * Replay, shown as a comparison rather than as a result.
 *
 * The claim is that the decision is reproducible, and one word cannot make it:
 * what matters is that two independent runs — one at the time of the call, one
 * now — produced the same disposition from the same recorded inputs.
 */
export function ReplayResult({ step }: { step: ReplayStep }) {
  if (step.unavailable) {
    return <p className="text-[12.5px] text-fg-3 m-0">{step.unavailable}</p>;
  }

  const match = step.agrees;
  const rows: [string, string][] = [
    ['Original', WORD[step.recorded]],
    ['Replay', step.rederived ? WORD[step.rederived] : '—'],
    ['Policy', step.reasons.join(', ') || '—'],
    ['Disposition', match ? 'Match' : 'Changed'],
  ];

  return (
    <div>
      <p
        className={`flex items-center gap-2 text-[13px] font-medium m-0 ${
          match ? 'text-trusted' : 'text-blocked'
        }`}
      >
        {match ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <CircleX className="size-3.5" aria-hidden />
        )}
        {match ? 'Deterministic' : 'Disposition changed since the call'}
      </p>
      <dl className="grid grid-cols-[minmax(0,12ch)_1fr] gap-x-6 gap-y-1.5 mt-3 m-0">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[12px] text-fg-4">{k}</dt>
            <dd className="m-0 font-mono text-[12px] text-fg-2 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The full record of one decision.
 *
 * A sheet, because it is always about something selected elsewhere and because
 * the technical depth here is the second thing a reader wants, never the first.
 * The table says what happened; this says exactly how.
 */
export function DecisionDrawer({
  entry,
  entries,
  tools,
  autoReplay = false,
  onRelease,
  onClose,
}: {
  entry: LedgerEntry;
  entries: readonly LedgerEntry[];
  tools: readonly DiscoveredTool[];
  /** Opened straight from "Replay", so the comparison is already there. */
  autoReplay?: boolean;
  onRelease: (entry: LedgerEntry) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ReplayStep | null>(null);

  // Replay is pure over recorded data, so running it on open costs nothing and
  // cannot touch a capability.
  useEffect(() => {
    setStep(autoReplay ? (replayEntry(entry, entries, tools) ?? null) : null);
  }, [entry, entries, tools, autoReplay]);

  const blocked = entry.outcome === 'blocked';
  const target = originNameFor(entry.origin) ?? entry.origin;
  const source = entry.decision.taint[0]?.source;

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {blocked && <CircleX className="size-4 text-blocked" aria-hidden />}
          <span className={blocked ? 'text-blocked' : undefined}>
            {blocked ? 'Blocked' : 'Policy decision'}
          </span>
          <Badge tone={toneForDisposition(entry.decision.disposition)}>{entry.outcome}</Badge>
        </span>
      }
      subtitle={<span className="font-mono">{entry.toolName}</span>}
      footer={
        blocked ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[12px] text-fg-4 m-0 max-w-[38ch]">
              Releasing is a human action taken here. Nothing on the agent&apos;s tool surface
              leads to it.
            </p>
            <Button variant="destructive" size="sm" icon={ShieldOff} onClick={() => onRelease(entry)}>
              Review and release
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-6">
        <section>
          <SectionTitle className="mb-3">Trust path</SectionTitle>
          <ProvenanceChainView chain={chainFor(entry, entries)} />
        </section>

        <Separator />

        <section>
          <SectionTitle className="mb-3">Decision</SectionTitle>
          <Facts
            rows={[
              ['Capability', <span key="c" className="font-mono text-[12.5px]">{entry.toolName}</span>],
              ['Target origin', target],
              ['Source provenance', source ? source.toolName : 'none tracked'],
              [
                'Trust transition',
                source ? `${source.origin} → ${target} write` : `${target} read`,
              ],
              ['Policy', entry.decision.reasons.map((r) => r.code).join(', ') || '—'],
              ['Executed', blocked ? 'No' : 'Yes'],
            ]}
          />
          <div className="mt-4 grid gap-2">
            {entry.decision.reasons.map((r, i) => (
              <p key={i} className="text-[13px] leading-[1.6] text-fg-3 m-0">
                {r.detail}
              </p>
            ))}
          </div>
          {blocked && (
            <p className="text-[13px] mt-3 text-fg m-0">
              {target} never received the call. The policy engine refused it in this page, before
              the mediated proxy reached the origin.
            </p>
          )}
        </section>

        <Separator />

        <section>
          <SectionTitle
            className="mb-3"
            action={
              step ? undefined : (
                <Button
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => setStep(replayEntry(entry, entries, tools) ?? null)}
                >
                  Replay decision
                </Button>
              )
            }
          >
            Replay
          </SectionTitle>
          {step ? (
            <ReplayResult step={step} />
          ) : (
            <p className="text-[12.5px] text-fg-4 m-0">
              Recomputes this decision from the recorded arguments and provenance. Policy
              evaluation only — replay has no path to a capability.
            </p>
          )}
        </section>

        <Separator />

        <section>
          <SectionTitle className="mb-3">Arguments</SectionTitle>
          <pre className="bg-surface-2 rounded-sm p-3 text-[11.5px] leading-[1.6] text-fg-3
                          whitespace-pre-wrap break-words overflow-x-auto m-0">
            {JSON.stringify(entry.args, null, 2)}
          </pre>
        </section>

        {(entry.error ?? entry.result) && (
          <section>
            <SectionTitle className="mb-3">{entry.error ? 'Error' : 'Result'}</SectionTitle>
            <pre className="bg-surface-2 rounded-sm p-3 text-[11.5px] leading-[1.6] text-fg-3
                            whitespace-pre-wrap break-words overflow-x-auto m-0">
              {entry.error ?? entry.result?.slice(0, 900)}
            </pre>
          </section>
        )}
      </div>
    </Sheet>
  );
}
