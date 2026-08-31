import { useCallback, useState } from 'react';
import { Check, CircleX, Loader2, Play, ScanSearch } from 'lucide-react';
import type { DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { Button } from './primitives';

/**
 * The three calls the seller's notes ask for, in order.
 *
 * The third is only interesting because the first two happened: the taint it
 * carries exists because of step one, and the value it carries came from step
 * two.
 */
const STEPS = [
  {
    toolName: 'bazaar_read_listing',
    title: 'Bazaar listing read',
    args: { id: '4412' } as Record<string, unknown>,
  },
  {
    toolName: 'vault_read_record',
    title: 'Vault record accessed',
    args: { id: 'rec-1' } as Record<string, unknown>,
  },
  {
    toolName: 'dispatch_send_message',
    title: 'Dispatch write attempted',
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

function StepMark({ state }: { state: StepState }) {
  const glyph =
    state === 'running' ? (
      <Loader2 className="size-3.5 text-system animate-spin" aria-hidden />
    ) : state === 'blocked' ? (
      <CircleX className="size-3.5 text-blocked" aria-hidden />
    ) : state === 'allowed' ? (
      <Check className="size-3.5 text-trusted" aria-hidden />
    ) : state === 'failed' ? (
      <CircleX className="size-3.5 text-semi" aria-hidden />
    ) : (
      <span aria-hidden className="size-[6px] rounded-full ring-1 ring-line-3" />
    );

  return <span className="grid place-items-center size-4 shrink-0">{glyph}</span>;
}

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
 * Each row's state is read back from the ledger entry the call produced, so the
 * sequence cannot report a block that policy did not make. Lock the vault and
 * step two fails instead — which is what should happen.
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
  /** Measured round trip of the refused call, not a decorative number. */
  const [decidedIn, setDecidedIn] = useState<number | null>(null);

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const ready = STEPS.every((s) => byName[s.toolName]);

  const entryFor = (toolName: string, index: number): LedgerEntry | undefined =>
    index <= reached ? entries.find((e) => e.toolName === toolName) : undefined;

  const run = useCallback(async () => {
    setRunning(true);
    setReached(-1);
    setDecidedIn(null);
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]!;
      const tool = byName[step.toolName];
      if (!tool) break;
      onActive(step.toolName);
      const started = performance.now();
      await onCall(tool, step.args);
      if (i === STEPS.length - 1) setDecidedIn(Math.round(performance.now() - started));
      setReached(i);
    }
    onActive(undefined);
    setRunning(false);
  }, [byName, onCall, onActive]);

  const refused =
    reached >= 0
      ? entries.find((e) => e.toolName === 'dispatch_send_message' && e.outcome === 'blocked')
      : undefined;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-fg-3 max-w-[46ch] m-0 leading-[1.6]">
          A seller listing instructs the agent to publish the buyer&apos;s account reference to a
          public channel.
        </p>
        <Button
          variant="primary"
          size="lg"
          icon={Play}
          onClick={() => void run()}
          disabled={!ready || running}
        >
          {running ? 'Running' : 'Run attack demo'}
        </Button>
      </div>

      {!ready && (
        <p className="text-[12.5px] text-fg-4 mt-3 m-0">
          Waiting for all three capabilities. Unlock the vault in Origins.
        </p>
      )}

      <ol className="list-none p-0 m-0 mt-5 grid gap-3">
        {STEPS.map((step, i) => {
          const entry = entryFor(step.toolName, i);
          const state: StepState = running && i === reached + 1 ? 'running' : stateOf(entry);

          return (
            <li key={step.toolName} className="flex items-center gap-2.5">
              <StepMark state={state} />
              <span
                className={`text-[13px] ${state === 'idle' ? 'text-fg-4' : state === 'blocked' ? 'text-blocked' : 'text-fg-2'}`}
              >
                {step.title}
              </span>
              <span className="ml-auto font-mono text-[11.5px] text-fg-4">{WORD[state]}</span>
            </li>
          );
        })}
      </ol>

      {refused && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-[14px] font-medium text-fg m-0">
            dispatch never received the call.
          </p>
          <p className="text-[12.5px] text-fg-3 mt-1.5 m-0">
            Cross-trust-boundary flow refused by the policy engine
            {decidedIn !== null && <> in {decidedIn} ms</>}.
          </p>
          <Button
            className="mt-3.5"
            size="sm"
            icon={ScanSearch}
            onClick={() => onInspect(refused)}
          >
            Inspect decision
          </Button>
        </div>
      )}
    </div>
  );
}
