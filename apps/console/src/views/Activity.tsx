import { Check, CircleX, Info, RotateCcw, Trash2 } from 'lucide-react';
import { originNameFor, type DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry, Outcome } from '../state/ledger';
import { replay, type ReplayReport } from '../state/replay';
import {
  Badge,
  Button,
  Cell,
  EmptyState,
  Row,
  RowButton,
  Table,
  ViewHeader,
  type Tone,
} from '../ui/primitives';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

const TONE: Record<Outcome, Tone> = {
  blocked: 'blocked',
  allowed: 'trusted',
  confirmed: 'semi',
  overridden: 'semi',
  declined: 'neutral',
  failed: 'semi',
};

const WORD: Record<Outcome, string> = {
  blocked: 'Blocked',
  allowed: 'Allowed',
  confirmed: 'Confirmed',
  overridden: 'Overridden',
  declined: 'Declined',
  failed: 'Failed',
};

/**
 * The ledger, as a log.
 *
 * A table rather than a stack of cards: the value of an audit record is that
 * rows can be compared, and three paragraphs per entry makes comparison
 * impossible. Depth is in the sheet, one click from any row.
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
        lede="Every mediated call and the decision behind it, kept as data rather than as prose in a transcript. Survives a reload."
        actions={
          entries.length > 0 ? (
            <>
              <Button size="sm" icon={RotateCcw} onClick={() => onReplayAll(replay(entries, tools))}>
                {replayed ? 'Replay again' : 'Replay log'}
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={onClear}>
                Clear
              </Button>
            </>
          ) : undefined
        }
      />

      {replayed && (
        <div className="flex items-center gap-3 flex-wrap mb-5 text-[12.5px]">
          <span
            className={`flex items-center gap-1.5 font-medium ${
              replayed.diverged === 0 ? 'text-trusted' : 'text-blocked'
            }`}
          >
            {replayed.diverged === 0 ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <CircleX className="size-3.5" aria-hidden />
            )}
            {replayed.diverged === 0 ? 'Deterministic' : `${replayed.diverged} diverged`}
          </span>
          <span className="text-fg-3">
            {replayed.reproduced} of {replayed.steps.length} decisions reproduced from the record
            {replayed.skipped > 0 && `, ${replayed.skipped} skipped`}
          </span>
          <span className="flex items-center gap-1.5 text-fg-4">
            <Info className="size-3.5" aria-hidden />
            policy evaluation only — nothing was invoked
          </span>
        </div>
      )}

      <div className="bg-surface rounded-md ring-1 ring-line overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            title="No mediated calls yet"
            detail="Run the attack demo from Overview, or call a capability from Origins."
          />
        ) : (
          <Table
            head={['Capability', 'Origin', 'Policy', 'Decision', 'Time']}
            label="Mediated calls"
          >
            {entries.map((e) => {
              const step = replayed?.steps.find((s) => s.entry.id === e.id);
              return (
                <Row key={e.id} onSelect={() => onSelect(e)} selected={e.id === selectedId}>
                  <Cell>
                    <RowButton mono onSelect={() => onSelect(e)}>
                      {e.toolName}
                    </RowButton>
                  </Cell>
                  <Cell muted>{originNameFor(e.origin) ?? e.origin}</Cell>
                  <Cell mono muted>
                    {e.decision.reasons[0]?.code ?? '—'}
                  </Cell>
                  <Cell>
                    <span className="inline-flex items-center gap-2">
                      <Badge tone={TONE[e.outcome]} icon={e.outcome === 'blocked' ? CircleX : Check}>
                        {WORD[e.outcome]}
                      </Badge>
                      {step && !step.unavailable && (
                        <span
                          className={`text-[11.5px] ${step.agrees ? 'text-fg-4' : 'text-blocked'}`}
                          title="Replayed disposition"
                        >
                          {step.agrees ? 'replay match' : 'replay differs'}
                        </span>
                      )}
                    </span>
                  </Cell>
                  <Cell mono muted>
                    {clock(e.at)}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </div>
    </div>
  );
}
