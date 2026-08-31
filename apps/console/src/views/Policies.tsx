import { useState } from 'react';
import { CircleHelp, ShieldCheck, ShieldX } from 'lucide-react';
import { POLICY_RULES, type Disposition, type PolicyRule } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { Sheet } from '../ui/Sheet';
import {
  Badge,
  Cell,
  Dot,
  Facts,
  Row,
  RowButton,
  SectionTitle,
  Table,
  ViewHeader,
  toneForDisposition,
} from '../ui/primitives';

const WORD: Record<Disposition, string> = {
  block: 'Block',
  confirm: 'Consent',
  allow: 'Allow',
};

const ICON = {
  block: ShieldX,
  confirm: CircleHelp,
  allow: ShieldCheck,
} as const;

/**
 * The rules, as the engine holds them.
 *
 * Read from `POLICY_RULES` in the policy package — the same module that
 * implements them, keyed by the same reason codes decisions carry — so this view
 * cannot drift into describing a policy the engine does not have. The count is
 * how many times each rule appears in this session's ledger.
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
        lede="Deterministic rules evaluated before any mediated capability runs. The strictest matching rule decides."
      />

      {/* One line of shape, counted from the rule table itself. Not four tiles. */}
      <p className="flex items-center gap-2.5 flex-wrap text-[12.5px] text-fg-3 -mt-2 mb-5">
        <span className="text-fg-2">{POLICY_RULES.length} active rules</span>
        {(['block', 'confirm', 'allow'] as const).map((d) => {
          const n = POLICY_RULES.filter((r) => r.disposition === d).length;
          if (n === 0) return null;
          return (
            <span key={d} className="flex items-center gap-1.5">
              <span className="text-fg-4" aria-hidden>
                ·
              </span>
              <Dot tone={toneForDisposition(d)} />
              {n} {WORD[d]}
            </span>
          );
        })}
      </p>

      <div className="bg-surface rounded-md ring-1 ring-line overflow-hidden">
        <Table
          head={['Policy', 'Source', 'Target', 'Action', 'Fired']}
          label="Policy rules"
        >
          {POLICY_RULES.map((rule) => {
            const Icon = ICON[rule.disposition];
            return (
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
                  <Badge tone={toneForDisposition(rule.disposition)} icon={Icon}>
                    {WORD[rule.disposition]}
                  </Badge>
                </Cell>
                <Cell mono muted>
                  {fired.get(rule.code) ?? 0}
                </Cell>
              </Row>
            );
          })}
        </Table>
      </div>

      {selected && (
        <Sheet
          onClose={() => setSelected(null)}
          title={selected.name}
          subtitle={<span className="font-mono">{selected.code}</span>}
        >
          <div className="grid gap-6">
            <section>
              <SectionTitle className="mb-3">Condition</SectionTitle>
              <p className="text-[13px] text-fg-2 leading-[1.6] m-0">{selected.condition}</p>
            </section>

            <section>
              <SectionTitle className="mb-3">Enforcement</SectionTitle>
              <Facts
                rows={[
                  ['Source', selected.source],
                  ['Target', selected.target],
                  ['Disposition', WORD[selected.disposition]],
                  ['Fired this session', String(fired.get(selected.code) ?? 0)],
                ]}
              />
            </section>

            <p className="text-[12px] text-fg-4 m-0">
              Every decision in the log carries the reason code of the rule that produced it, so a
              refusal can be traced back to this row.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
