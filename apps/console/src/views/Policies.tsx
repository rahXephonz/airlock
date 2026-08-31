import { useState } from 'react';
import { POLICY_RULES, type PolicyRule } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import {
  Cell,
  Facts,
  Panel,
  Row,
  RowButton,
  Table,
  Tag,
  ViewHeader,
  toneForDisposition,
} from '../ui/primitives';

const WORD = { block: 'BLOCK', confirm: 'CONSENT', allow: 'ALLOW' } as const;

/**
 * The rules, as the engine holds them.
 *
 * These are read from `POLICY_RULES` in the policy package — the same module
 * that implements them, keyed by the same reason codes decisions carry — so this
 * view cannot drift into describing a policy the engine does not have. The count
 * beside each rule is how many times it appears in this session's ledger.
 *
 * Nothing here is generated, ranked or interpreted by a model.
 */
export function Policies({ entries }: { entries: readonly LedgerEntry[] }) {
  const [selected, setSelected] = useState<PolicyRule | null>(null);

  const fired = new Map<string, number>();
  for (const e of entries) {
    for (const r of e.decision.reasons) fired.set(r.code, (fired.get(r.code) ?? 0) + 1);
  }

  return (
    <div>
      <ViewHeader
        title="Policies"
        lede="Deterministic rules evaluated before every mediated call. The strictest matching rule decides."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
        <Panel padded={false}>
          <Table
            head={['Policy', 'Source', 'Target', 'Action', 'Fired']}
            label="Policy rules"
          >
            {POLICY_RULES.map((rule) => (
              <Row
                key={rule.code}
                onSelect={() => setSelected(rule)}
                selected={selected?.code === rule.code}
              >
                <Cell wide>
                  <RowButton onSelect={() => setSelected(rule)}>{rule.name}</RowButton>
                </Cell>
                <Cell muted wide>
                  {rule.source}
                </Cell>
                <Cell muted wide>
                  {rule.target}
                </Cell>
                <Cell>
                  <Tag tone={toneForDisposition(rule.disposition)}>{WORD[rule.disposition]}</Tag>
                </Cell>
                <Cell mono muted>
                  {fired.get(rule.code) ?? 0}
                </Cell>
              </Row>
            ))}
          </Table>
        </Panel>

        <Panel label={selected ? 'Rule' : 'Select a rule'}>
          {selected ? (
            <div className="grid gap-4">
              <Facts
                rows={[
                  ['Name', selected.name],
                  ['Reason code', <code key="c">{selected.code}</code>],
                  ['Source', selected.source],
                  ['Target', selected.target],
                  ['Disposition', WORD[selected.disposition]],
                  ['Fired this session', String(fired.get(selected.code) ?? 0)],
                ]}
              />
              <p className="text-ink-2 text-[13px] m-0">{selected.condition}</p>
            </div>
          ) : (
            <p className="text-ink-3 text-[13px] m-0">
              Every decision in the log carries the reason code of the rule that produced it.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
