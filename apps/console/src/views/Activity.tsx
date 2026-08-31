import { originNameFor, type DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry, Outcome } from '../state/ledger';
import { replay, type ReplayReport } from '../state/replay';
import {
  Button,
  Cell,
  Dot,
  Empty,
  LABEL,
  Panel,
  Row,
  RowButton,
  Table,
  Tag,
  ViewHeader,
  type Tone,
} from '../ui/primitives';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

const TONE: Record<Outcome, Tone> = {
  blocked: 'bad',
  allowed: 'trusted',
  confirmed: 'semi',
  overridden: 'semi',
  declined: 'neutral',
  failed: 'semi',
};

const WORD: Record<Outcome, string> = {
  blocked: 'BLOCK',
  allowed: 'ALLOW',
  confirmed: 'CONFIRM',
  overridden: 'OVERRIDE',
  declined: 'DECLINE',
  failed: 'FAIL',
};

/**
 * The ledger, as a log.
 *
 * A table rather than a stack of cards: the value of an audit record is that
 * rows can be compared, and three paragraphs per entry makes comparison
 * impossible. Depth is in the drawer, one click from any row.
 */
export function Activity({
  entries,
  tools,
  selectedId,
  replayed,
  onSelect,
  onReplayAll,
  onClear,
}: {
  entries: readonly LedgerEntry[];
  tools: readonly DiscoveredTool[];
  selectedId: string | undefined;
  replayed: ReplayReport | null;
  onSelect: (entry: LedgerEntry) => void;
  onReplayAll: (report: ReplayReport) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <ViewHeader
        title="Activity"
        lede="Every mediated call and the decision behind it, kept as data rather than as prose in a transcript. It survives a reload."
        actions={
          entries.length > 0 ? (
            <>
              <Button tone="primary" onClick={() => onReplayAll(replay(entries, tools))}>
                {replayed ? 'Replay again' : 'Replay the log'}
              </Button>
              <Button onClick={onClear}>Clear</Button>
            </>
          ) : undefined
        }
      />

      <Panel padded={false}>
        {entries.length === 0 ? (
          <Empty>Nothing yet. Run the scenario from Overview.</Empty>
        ) : (
          <Table head={['Time', 'Capability', 'Origin', 'Policy', 'Decision']} label="Mediated calls">
            {entries.map((e) => (
              <Row key={e.id} onSelect={() => onSelect(e)} selected={e.id === selectedId}>
                <Cell mono muted>
                  {clock(e.at)}
                </Cell>
                <Cell mono>
                  <RowButton mono onSelect={() => onSelect(e)}>
                    {e.toolName}
                  </RowButton>
                </Cell>
                <Cell muted>{originNameFor(e.origin) ?? e.origin}</Cell>
                <Cell mono muted>
                  {e.decision.reasons[0]?.code ?? '—'}
                </Cell>
                <Cell>
                  <span className="inline-flex gap-2 items-center">
                    {e.outcome === 'blocked' ? (
                      <span className="text-blocked font-mono text-[12px]" aria-hidden>
                        ✕
                      </span>
                    ) : (
                      <Dot tone={TONE[e.outcome]} />
                    )}
                    <Tag tone={TONE[e.outcome]}>{WORD[e.outcome]}</Tag>
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      {replayed && (
        <div className="mt-5">
          <Panel label="Log replay">
            <div
              className={`rounded-[2px] px-3.5 py-2.5 text-[13px] border ${
                replayed.diverged === 0
                  ? 'bg-trusted-dim border-[#2a4c42] text-trusted'
                  : 'bg-[#1d1214] border-blocked-dim text-[#f6d6d6]'
              }`}
            >
              {replayed.reproduced} of {replayed.steps.length} decisions reproduced from the record
              {replayed.diverged > 0 && `, ${replayed.diverged} diverged`}
              {replayed.skipped > 0 && `, ${replayed.skipped} skipped`}.
            </div>

            <p className="text-ink-3 text-[12.5px] mt-3 max-w-[76ch]">
              Each step was recomputed by the policy engine from the arguments the log stored,
              with the taint chain rebuilt in call order rather than read back. Replay evaluates
              policy; it invokes nothing.
            </p>

            <ul className="list-none p-0 m-0 mt-3.5 grid gap-px bg-seam border border-seam rounded-[2px] overflow-hidden">
              {replayed.steps.map((s) => (
                <li
                  key={s.entry.id}
                  className="bg-panel px-3.5 py-2 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center"
                >
                  <span
                    className={`font-mono text-[12px] ${
                      s.unavailable ? 'text-ink-3' : s.agrees ? 'text-trusted' : 'text-blocked'
                    }`}
                    aria-hidden
                  >
                    {s.unavailable ? '–' : s.agrees ? '✓' : '!'}
                  </span>
                  <code className="font-mono text-[12.5px] truncate">{s.entry.toolName}</code>
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {s.unavailable
                      ? 'not published now'
                      : `${s.recorded} → ${s.rederived ?? '—'}`}
                  </span>
                </li>
              ))}
            </ul>

            <p className={`${LABEL} mt-3`}>
              Truncated results may weaken a taint match on very long output
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
