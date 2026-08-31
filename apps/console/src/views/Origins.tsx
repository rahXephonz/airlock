import { useState } from 'react';
import { TRUST, type DiscoveredTool, type OriginName } from '@airlock/shared';
import { ToolCard } from '../ui/ToolCard';
import {
  Cell,
  Dot,
  Facts,
  Panel,
  Row,
  RowButton,
  Table,
  Tag,
  ViewHeader,
  toneForTrust,
} from '../ui/primitives';

const PARTNERS = ['vault', 'dispatch', 'bazaar'] as const;

/**
 * The origins Airlock federates, and what each currently publishes.
 *
 * Trust is Airlock's own classification, fixed here and never moved by anything
 * an origin asserts about itself. The tool count is live: lock the vault in its
 * own frame below and the row drops to zero without a reload, because the
 * mediated surface follows partner state rather than a snapshot taken at boot.
 */
export function Origins({
  tools,
  unreachable,
  onCall,
}: {
  tools: readonly DiscoveredTool[];
  unreachable: ReadonlySet<string>;
  onCall: (tool: DiscoveredTool, args: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<OriginName>('vault');

  const countFor = (name: OriginName) => tools.filter((t) => t.profile?.name === name).length;
  const profile = TRUST[selected];
  const published = tools.filter((t) => t.profile?.name === selected);
  const down = unreachable.has(selected);

  return (
    <div>
      <ViewHeader
        title="Origins"
        lede="Four independently deployed origins. Trust is Airlock's classification of each, not a claim the origin makes."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
        <Panel padded={false}>
          <Table head={['Origin', 'Trust', 'Capabilities', 'State']} label="Federated origins">
            {(['console', ...PARTNERS] as const).map((name) => {
              const p = TRUST[name];
              const count = countFor(name);
              const offline = name !== 'console' && unreachable.has(name);
              return (
                <Row key={name} onSelect={() => setSelected(name)} selected={selected === name}>
                  <Cell mono>
                    <RowButton mono onSelect={() => setSelected(name)}>
                      {p.name}
                    </RowButton>
                  </Cell>
                  <Cell>
                    <Tag tone={toneForTrust(p.trust)}>{p.trust}</Tag>
                  </Cell>
                  <Cell mono muted>
                    {name === 'console' ? 'policy engine' : count}
                  </Cell>
                  <Cell>
                    <span className="inline-flex gap-2 items-center">
                      <Dot tone={offline ? 'bad' : 'trusted'} hollow={offline} />
                      <span className={offline ? 'text-blocked' : 'text-ink-2'}>
                        {offline ? 'Unavailable' : 'Online'}
                      </span>
                    </span>
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </Panel>

        <Panel label={profile.name}>
          <Facts
            rows={[
              ['Trust', profile.trust],
              ['URL', profile.url.replace('https://', '')],
              ['Untrusted content', profile.emitsUntrustedContent ? 'yes' : 'no'],
              ['Capabilities', selected === 'console' ? 'policy engine' : String(published.length)],
              ['State', down ? 'Unavailable' : 'Online'],
            ]}
          />
          <p className="text-ink-2 text-[13px] mt-4 m-0">{profile.rationale}</p>
        </Panel>
      </div>

      <section className="mt-6">
        <h3 className="text-[14px] font-semibold m-0 mb-1">
          {selected === 'console'
            ? 'Airlock publishes its own policy tools'
            : `Capabilities published by ${profile.name}`}
        </h3>
        <p className="text-ink-3 text-[12.5px] mb-3.5">
          A call from here goes through the same policy engine an agent&apos;s call does. What an
          origin claims about a tool is recorded and never used to decide anything.
        </p>

        <div className="grid gap-2.5">
          {published.length === 0 && (
            <p className="text-ink-3 text-[13px] m-0">
              {selected === 'console'
                ? 'Airlock’s own tools are listed in the WebMCP view.'
                : down
                  ? 'This origin did not load, so its tools are absent.'
                  : 'Nothing published right now.'}
            </p>
          )}
          {published.map((t) => (
            <ToolCard key={`${t.raw.origin}-${t.name}`} tool={t} onRun={onCall} />
          ))}
        </div>
      </section>
    </div>
  );
}
