import { useCallback, useState } from 'react';
import type { DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { Button, Dot, LABEL } from './primitives';

/**
 * The three calls the seller's notes ask for, in order.
 *
 * The third is only interesting because the first two happened: the taint it
 * carries exists because of step one, and the value it carries came from step
 * two. Running them in sequence is the demonstration.
 */
const STEPS = [
  {
    toolName: 'bazaar_read_listing',
    title: 'Read the listing',
    origin: 'bazaar',
    args: { id: '4412' } as Record<string, unknown>,
  },
  {
    toolName: 'vault_read_record',
    title: 'Read the billing record',
    origin: 'vault',
    args: { id: 'rec-1' } as Record<string, unknown>,
  },
  {
    toolName: 'dispatch_send_message',
    title: 'Publish the account reference',
    origin: 'dispatch',
    args: { body: 'ORDER 4412 ref=ACCT-7731-QX45' } as Record<string, unknown>,
  },
] as const;

type StepState = 'idle' | 'running' | 'allowed' | 'blocked' | 'failed';

const stateOf = (entry: LedgerEntry | undefined): StepState =>
  !entry
    ? 'idle'
    : entry.outcome === 'blocked' || entry.outcome === 'declined'
      ? 'blocked'
      : entry.outcome === 'failed'
        ? 'failed'
        : 'allowed';

const WORD: Record<StepState, string> = {
  idle: 'not run',
  running: 'running',
  allowed: 'allowed',
  blocked: 'blocked',
  failed: 'failed',
};

/**
 * Runs the adversarial scenario through the real mediator.
 *
 * Every row's state is read back from the ledger entry the call produced, so
 * the sequence cannot report a block that policy did not make. There is no
 * scripted outcome here — lock the vault and step two fails instead, which is
 * exactly what should happen.
 */
export function AttackRunner({
  tools,
  entries,
  onCall,
  onActive,
  onInspect,
}: {
  tools: readonly DiscoveredTool[];
  entries: readonly LedgerEntry[];
  onCall: (tool: DiscoveredTool, args: Record<string, unknown>) => Promise<void>;
  onActive: (toolName: string | undefined) => void;
  onInspect: (entry: LedgerEntry) => void;
}) {
  const [running, setRunning] = useState(false);
  const [reached, setReached] = useState(-1);

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const ready = STEPS.every((s) => byName[s.toolName]);

  const entryFor = (toolName: string, index: number): LedgerEntry | undefined =>
    index <= reached ? entries.find((e) => e.toolName === toolName) : undefined;

  const run = useCallback(async () => {
    setRunning(true);
    setReached(-1);
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]!;
      const tool = byName[step.toolName];
      if (!tool) break;
      onActive(step.toolName);
      await onCall(tool, step.args);
      setReached(i);
    }
    onActive(undefined);
    setRunning(false);
  }, [byName, onCall, onActive]);

  const refused = reached >= 0
    ? entries.find((e) => e.toolName === 'dispatch_send_message' && e.outcome === 'blocked')
    : undefined;

  return (
    <div>
      <div className="flex gap-3 items-center flex-wrap">
        <Button tone="danger" onClick={() => void run()} disabled={!ready || running}>
          {running ? 'Running…' : 'Run attack demo'}
        </Button>
        {!ready && (
          <span className="text-[12.5px] text-ink-3">
            Waiting for all three capabilities. Unlock the vault in Origins.
          </span>
        )}
      </div>

      <ol className="list-none p-0 mt-4 m-0 grid gap-px bg-seam border border-seam rounded-[3px] overflow-hidden">
        {STEPS.map((step, i) => {
          const entry = entryFor(step.toolName, i);
          const state: StepState = running && i === reached + 1 ? 'running' : stateOf(entry);

          return (
            <li
              key={step.toolName}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-3.5 py-2.5 ${
                state === 'blocked' ? 'bg-[#150f11]' : 'bg-panel'
              }`}
            >
              <div className="flex gap-2.5 items-center min-w-0">
                <span className="font-mono text-[11px] text-ink-3 tabular-nums w-3">{i + 1}</span>
                <span
                  className={`text-[13px] ${state === 'idle' ? 'text-ink-3' : 'text-ink'} truncate`}
                >
                  {step.title}
                </span>
                <code className="font-mono text-[11.5px] text-ink-3 truncate">{step.toolName}</code>
              </div>

              <span className="flex gap-2 items-center">
                {state === 'blocked' ? (
                  <span className="text-blocked font-mono text-[12px]" aria-hidden>
                    ✕
                  </span>
                ) : (
                  <Dot
                    tone={
                      state === 'allowed' ? 'trusted' : state === 'running' ? 'self' : 'neutral'
                    }
                    hollow={state === 'idle'}
                  />
                )}
                <span
                  className={`font-mono text-[11.5px] ${
                    state === 'blocked'
                      ? 'text-blocked'
                      : state === 'allowed'
                        ? 'text-trusted'
                        : 'text-ink-3'
                  }`}
                >
                  {WORD[state]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {refused && (
        <div className="mt-4 border border-blocked-dim border-l-[3px] border-l-blocked bg-[#150f11] rounded-[3px] px-4 py-3.5">
          <p className={`${LABEL} text-blocked`}>Blocked by Airlock</p>
          <p className="text-[14px] mt-2 max-w-[64ch]">
            Untrusted provenance from <span className="font-mono text-semi">bazaar</span> attempted
            to cross into a trusted write on{' '}
            <span className="font-mono text-trusted">dispatch</span>.
          </p>
          <p className="text-[14px] font-medium mt-1.5">dispatch never received the call.</p>
          <div className="mt-3.5">
            <Button onClick={() => onInspect(refused)}>Inspect decision</Button>
          </div>
        </div>
      )}
    </div>
  );
}
