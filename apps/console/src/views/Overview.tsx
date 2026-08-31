import type { DiscoveredTool } from '@airlock/shared';
import type { LedgerEntry } from '../state/ledger';
import { flowFor } from '../state/trustflow';
import { TrustGraph } from '../ui/TrustGraph';
import { AttackRunner } from '../ui/AttackRunner';
import { DecisionSummary } from '../ui/DecisionSummary';
import { Panel } from '../ui/primitives';

/**
 * The landing view.
 *
 * One claim, one live picture, one button. A judge who reads nothing else
 * should still leave knowing that several origins publish capabilities, that an
 * agent can carry a value between them, and that something in the middle refused
 * to let it. Everything that explains *how* lives one click away.
 */
export function Overview({
  tools,
  entries,
  activeTool,
  degraded,
  onCall,
  onActive,
  onInspect,
  onReplay,
}: {
  tools: readonly DiscoveredTool[];
  entries: readonly LedgerEntry[];
  activeTool: string | undefined;
  /** Set while discovery has not settled, so the graph is not read as a result. */
  degraded: string | undefined;
  onCall: (tool: DiscoveredTool, args: Record<string, unknown>) => Promise<void>;
  onActive: (toolName: string | undefined) => void;
  onInspect: (entry: LedgerEntry) => void;
  onReplay: (entry: LedgerEntry) => void;
}) {
  const nodes = flowFor(entries, activeTool);
  const latest = entries[0];

  return (
    <div>
      <header className="mb-7">
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] m-0 max-w-[24ch]">
          Capability firewall for the agentic web.
        </h1>
        <p className="text-ink-2 text-[14px] mt-2.5 max-w-[62ch]">
          Browsers isolate origins. Agents bridge them. Airlock discovers WebMCP tools across
          origins, republishes them behind one policy-enforced surface, and refuses a
          cross-boundary flow before the capability is reached.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-start">
        <Panel label="Trust flow">
          <TrustGraph nodes={nodes} />
          {degraded && <p className="text-ink-3 text-[12px] mt-3.5">{degraded}</p>}
        </Panel>

        <div className="grid gap-5">
          <Panel label="Adversarial scenario">
            <AttackRunner
              tools={tools}
              entries={entries}
              onCall={onCall}
              onActive={onActive}
              onInspect={onInspect}
            />
          </Panel>

          {latest ? (
            <DecisionSummary
              entry={latest}
              onInspect={() => onInspect(latest)}
              onReplay={() => onReplay(latest)}
            />
          ) : (
            <Panel label="Latest decision">
              <p className="text-ink-3 text-[13px] m-0">
                No calls mediated yet. Run the scenario, or call a capability from Origins.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
