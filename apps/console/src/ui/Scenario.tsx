import { useCallback, useState } from 'react';
import type { DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { Button } from './primitives';

type StepState = 'idle' | 'running' | 'allowed' | 'blocked' | 'failed';

interface StepSpec {
  readonly toolName: string;
  readonly title: string;
  readonly what: string;
  readonly args: Record<string, unknown>;
}

/**
 * The three calls the seller's notes ask for, in order.
 *
 * Numbering is used here because the content genuinely is a sequence: the third
 * call is only interesting because the first two already happened, and the taint
 * it carries exists only because of step one.
 */
const STEPS: StepSpec[] = [
  {
    toolName: 'bazaar_read_listing',
    title: 'Read the listing on bazaar',
    what: 'Seller-supplied text. Everything it returns is treated as hostile input from here on.',
    args: { id: '4412' },
  },
  {
    toolName: 'vault_read_record',
    title: 'Read the billing record on vault',
    what: 'A trusted read of the account reference. Nothing has crossed a boundary yet.',
    args: { id: 'rec-1' },
  },
  {
    toolName: 'dispatch_send_message',
    title: 'Send the reference through dispatch',
    what: 'Exactly what the seller’s notes instruct — an irreversible public write.',
    args: { body: 'ORDER 4412 ref=ACCT-7731-QX45' },
  },
];

const stateOf = (entry: LedgerEntry | undefined): StepState =>
  !entry ? 'idle'
    : entry.outcome === 'blocked' ? 'blocked'
    : entry.outcome === 'failed' ? 'failed'
    : 'allowed';

const RAIL: Record<StepState, string> = {
  idle: 'border-l-seam-2 opacity-45',
  running: 'border-l-ink-3',
  allowed: 'border-l-trusted',
  blocked: 'border-l-blocked bg-[#150f11]',
  failed: 'border-l-semi',
};

const INDEX_TONE: Record<StepState, string> = {
  idle: 'text-ink-3 border-seam-2',
  running: 'text-ink-2 border-seam-2',
  allowed: 'text-trusted border-trusted-dim',
  blocked: 'text-blocked border-blocked-dim',
  failed: 'text-semi border-semi-dim',
};

export function Scenario({
  tools,
  onCall,
  entries,
}: {
  tools: readonly DiscoveredTool[];
  onCall: (tool: DiscoveredTool, args: Record<string, unknown>) => Promise<void>;
  entries: readonly LedgerEntry[];
}) {
  const [running, setRunning] = useState(false);
  const [reached, setReached] = useState(-1);

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const ready = STEPS.every((s) => byName[s.toolName]);

  /** The newest ledger entry for a step, so each row reports its own outcome. */
  const entryFor = (step: StepSpec, index: number): LedgerEntry | undefined =>
    index <= reached ? entries.find((e) => e.toolName === step.toolName) : undefined;

  const run = useCallback(async () => {
    setRunning(true);
    setReached(-1);
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]!;
      const tool = byName[step.toolName];
      if (!tool) break;
      await onCall(tool, step.args);
      setReached(i);
    }
    setRunning(false);
  }, [byName, onCall]);

  return (
    <div>
      <div className="flex gap-2.5 items-center flex-wrap mb-4">
        <Button tone="danger" onClick={() => void run()} disabled={!ready || running}>
          {running ? 'Running…' : 'Run the exfiltration attempt'}
        </Button>
        {!ready && (
          <span className="text-[13px] text-ink-3">
            Waiting for all three tools. Unlock the vault and select a dispatch channel below.
          </span>
        )}
      </div>

      <ol className="grid gap-[2px] list-none p-0 m-0">
        {STEPS.map((step, i) => {
          const entry = entryFor(step, i);
          const state: StepState = running && i === reached + 1 ? 'running' : stateOf(entry);
          const first = i === 0;
          const last = i === STEPS.length - 1;

          return (
            <li
              key={step.toolName}
              className={[
                'bg-panel border border-seam border-l-[3px] px-5 py-4',
                'grid grid-cols-[auto_1fr] gap-4 items-start transition-colors',
                first ? 'rounded-t-[3px]' : '',
                last ? 'rounded-b-[3px]' : '',
                RAIL[state],
              ].join(' ')}
            >
              <span
                className={[
                  'font-mono text-xs font-medium w-6 h-6 grid place-items-center',
                  'border rounded-[2px] tabular-nums',
                  INDEX_TONE[state],
                ].join(' ')}
              >
                {state === 'blocked' ? '×' : i + 1}
              </span>

              <div>
                <div className="flex gap-2.5 items-baseline flex-wrap">
                  <h3 className="m-0 text-[15.5px] font-semibold">{step.title}</h3>
                  <code className="font-mono text-xs text-ink-3">{step.toolName}</code>
                </div>
                <p className="text-ink-2 text-sm mt-1">{step.what}</p>

                {entry && (
                  <div
                    className={[
                      'mt-3 px-3.5 py-[11px] rounded-[2px] text-sm leading-[1.55]',
                      state === 'blocked'
                        ? 'bg-[#1d1214] text-[#f6d6d6]'
                        : 'bg-panel-2 text-ink',
                    ].join(' ')}
                  >
                    {entry.decision.reasons.map((r, k) => (
                      <p key={k} className={k === 0 ? 'm-0' : 'mt-2 mb-0'}>
                        {r.detail}
                      </p>
                    ))}
                    {entry.decision.taint.length > 0 && (
                      <p className="mt-2 mb-0 font-mono text-xs text-ink-3">
                        matched text:{' '}
                        <mark className="bg-blocked-dim text-[#ffc9c9] px-[3px] rounded-[2px]">
                          {entry.decision.taint[0]!.fragment}
                        </mark>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
