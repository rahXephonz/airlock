import { useEffect, useRef, useState } from 'react';
import { originNameFor, type DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { chainFor } from '../state/provenance';
import { replayEntry, type ReplayStep } from '../state/replay';
import { ProvenanceChainView } from './ProvenanceChain';
import { Button, Facts, LABEL, Tag, toneForDisposition } from './primitives';

const WORD = { block: 'BLOCK', confirm: 'CONFIRM', allow: 'ALLOW' } as const;

/**
 * Replay, shown as a comparison rather than as a result.
 *
 * The claim being made is that the decision is reproducible, and a single word
 * cannot make that claim: what matters is that two independent runs — one at the
 * time of the call, one now — produced the same disposition from the same
 * recorded inputs.
 */
function ReplayResult({ step }: { step: ReplayStep }) {
  if (step.unavailable) {
    return (
      <p className="text-ink-3 text-[12.5px] border border-seam rounded-[2px] px-3 py-2.5">
        {step.unavailable}
      </p>
    );
  }

  const match = step.agrees;
  return (
    <div
      className={`border rounded-[2px] px-3.5 py-3 ${
        match ? 'border-[#2a4c42] bg-trusted-dim' : 'border-blocked-dim bg-[#1d1214]'
      }`}
    >
      <dl className="grid grid-cols-[minmax(0,11ch)_1fr] gap-x-4 gap-y-1 m-0 font-mono text-[12.5px]">
        <dt className="text-ink-3">Original</dt>
        <dd className="m-0">{WORD[step.recorded]}</dd>
        <dt className="text-ink-3">Replay</dt>
        <dd className="m-0">{step.rederived ? WORD[step.rederived] : '—'}</dd>
        <dt className="text-ink-3">Policy</dt>
        <dd className="m-0 break-words">{step.reasons.join(', ') || '—'}</dd>
        <dt className="text-ink-3">Disposition</dt>
        <dd className="m-0">{match ? 'MATCH' : 'CHANGED'}</dd>
      </dl>
      <p
        className={`font-mono text-[11px] tracking-[0.1em] uppercase mt-2.5 ${
          match ? 'text-trusted' : 'text-blocked'
        }`}
      >
        {match ? '✓ Deterministic' : '! Disposition changed since the call'}
      </p>
    </div>
  );
}

/**
 * The full record of one decision.
 *
 * A drawer rather than a page because it is always about something selected
 * elsewhere — a row in the log, the latest refusal on the overview — and
 * because the technical depth here is the second thing a reader wants, never
 * the first. The table says what happened; this says exactly how.
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
  /** Opened straight from "Replay policy", so the comparison is already there. */
  autoReplay?: boolean;
  onRelease: (entry: LedgerEntry) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ReplayStep | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Replay is pure over recorded data, so running it on open costs nothing and
  // cannot touch a capability.
  useEffect(() => {
    setStep(autoReplay ? (replayEntry(entry, entries, tools) ?? null) : null);
  }, [entry, entries, tools, autoReplay]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const blocked = entry.outcome === 'blocked';
  const target = originNameFor(entry.origin) ?? entry.origin;
  const source = entry.decision.taint[0]?.source;
  const chain = chainFor(entry, entries);

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <button
        type="button"
        aria-label="Close decision"
        onClick={onClose}
        className="absolute inset-0 bg-[#04070999] border-0 cursor-default"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Policy decision for ${entry.toolName}`}
        tabIndex={-1}
        className="relative w-full max-w-[520px] h-full bg-ground border-l border-seam-2
                   overflow-y-auto overscroll-contain outline-none"
      >
        <header className="sticky top-0 bg-ground border-b border-seam px-5 py-3.5 flex gap-3 items-center justify-between">
          <div className="flex gap-2.5 items-center min-w-0">
            {blocked && (
              <span className="text-blocked font-mono text-[13px]" aria-hidden>
                ✕
              </span>
            )}
            <h2
              className={`text-[14px] font-semibold m-0 ${blocked ? 'text-blocked' : 'text-ink'}`}
            >
              {blocked ? 'Blocked' : 'Policy decision'}
            </h2>
            <Tag tone={toneForDisposition(entry.decision.disposition)}>{entry.outcome}</Tag>
          </div>
          <Button tone="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>

        <div className="px-5 py-5 grid gap-6">
          <section>
            <Facts
              rows={[
                ['Capability', <code key="c">{entry.toolName}</code>],
                ['Target origin', target],
                ['Source provenance', source ? source.toolName : 'none tracked'],
                [
                  'Trust transition',
                  source ? `${source.origin} → ${target} write` : `${target} read`,
                ],
                ['Capability invoked', blocked ? 'No' : 'Yes'],
                ['Policy', entry.decision.reasons.map((r) => r.code).join(', ') || '—'],
              ]}
            />
          </section>

          <section>
            <p className={LABEL}>Reason</p>
            {entry.decision.reasons.map((r, i) => (
              <p key={i} className="text-[13.5px] leading-[1.55] text-ink-2 mt-2">
                {r.detail}
              </p>
            ))}
            {blocked && (
              <p className="text-[13.5px] mt-3 text-ink">
                {target} never received the call. The policy engine refused it in this page,
                before the mediated proxy reached the origin.
              </p>
            )}
          </section>

          <section>
            <ProvenanceChainView chain={chain} title="Provenance" />
          </section>

          <section>
            <p className={LABEL}>Decision replay</p>
            <p className="text-ink-3 text-[12.5px] mt-2">
              Recomputes this decision from the recorded arguments and provenance. Policy
              evaluation only — replay has no path to a capability.
            </p>
            <div className="mt-3">
              {step ? (
                <ReplayResult step={step} />
              ) : (
                <Button
                  tone="primary"
                  onClick={() => setStep(replayEntry(entry, entries, tools) ?? null)}
                >
                  Replay policy
                </Button>
              )}
            </div>
          </section>

          <section>
            <p className={LABEL}>Arguments</p>
            <pre className="bg-[#0b1218] border border-seam rounded-[2px] p-3 mt-2 text-[11.5px]
                            leading-[1.55] text-ink-2 whitespace-pre-wrap break-words overflow-x-auto">
              {JSON.stringify(entry.args, null, 2)}
            </pre>
          </section>

          {(entry.error ?? entry.result) && (
            <section>
              <p className={LABEL}>{entry.error ? 'Error' : 'Result'}</p>
              <pre className="bg-[#0b1218] border border-seam rounded-[2px] p-3 mt-2 text-[11.5px]
                              leading-[1.55] text-ink-2 whitespace-pre-wrap break-words overflow-x-auto">
                {entry.error ?? entry.result?.slice(0, 900)}
              </pre>
            </section>
          )}

          {blocked && (
            <section className="border-t border-seam pt-5">
              <p className={LABEL}>Human override</p>
              <p className="text-ink-3 text-[12.5px] mt-2">
                Releasing sends the data across the boundary anyway. It is available here, to a
                person, and to nothing on the agent&apos;s tool surface.
              </p>
              <div className="mt-3">
                <Button tone="danger" onClick={() => onRelease(entry)}>
                  Review and release
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
