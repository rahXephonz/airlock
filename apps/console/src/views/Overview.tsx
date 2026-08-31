import { ArrowRight, Boxes, Globe, ShieldCheck } from "lucide-react";
import type { DiscoveredTool } from "@airlock/shared";
import type { LedgerEntry } from "../state/ledger";
import { flowFor } from "../state/trustflow";
import { TrustGraph } from "../ui/TrustGraph";
import { AttackRunner } from "../ui/AttackRunner";
import { DecisionSummary, NoDecisionYet } from "../ui/DecisionSummary";
import { Button, Dot, SectionTitle } from "../ui/primitives";

/**
 * The landing view.
 *
 * One claim, one live picture, one action. A judge who reads nothing else
 * should still leave knowing that several origins publish capabilities, that an
 * agent can carry a value between them, and that something in the middle
 * refused to let it. Everything explaining *how* is one click away.
 */
export function Overview({
  tools,
  entries,
  activeTool,
  origins,
  transport,
  degraded,
  onCall,
  onActive,
  onInspect,
  onReplay,
  onOpenActivity,
}: {
  tools: readonly DiscoveredTool[];
  entries: readonly LedgerEntry[];
  activeTool: string | undefined;
  origins: number;
  transport: "Native" | "Fallback" | "Starting";
  /** The fallback disclosure, when discovery did not federate. */
  degraded: string | undefined;
  onCall: (
    tool: DiscoveredTool,
    args: Record<string, unknown>,
  ) => Promise<void>;
  onActive: (toolName: string | undefined) => void;
  onInspect: (entry: LedgerEntry) => void;
  onReplay: (entry: LedgerEntry) => void;
  onOpenActivity: () => void;
}) {
  const nodes = flowFor(entries, activeTool);
  const latest = entries[0];
  const protectedNow = tools.length > 0;

  return (
    <div className="grid gap-5">
      <header className="flex items-start justify-between gap-8 flex-wrap mb-1">
        <div>
          <h1 className="text-[29px] leading-[1.15] font-semibold m-0 max-w-[18ch]">
            Capability firewall for the agentic web.
          </h1>
          <p className="text-[14px] text-fg-3 mt-5 max-w-[54ch] leading-[1.6]">
            WebMCP gives agents capabilities across websites. Airlock enforces
            trust boundaries before those capabilities execute.
          </p>

          <div className="flex items-center gap-4 mt-3.5 flex-wrap text-[12.5px] text-fg-3">
            <span className="flex items-center gap-1.5">
              <Globe className="size-3.5 text-fg-2" aria-hidden />
              {origins} origins
            </span>
            <span className="flex items-center gap-1.5">
              <Boxes className="size-3.5 text-fg-2" aria-hidden />
              {tools.length} mediated capabilities
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-fg-2" aria-hidden />
              Policy active
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span className="flex items-center gap-2 text-[12.5px]">
            <Dot
              tone={protectedNow ? "trusted" : "neutral"}
              hollow={!protectedNow}
            />
            <span className={protectedNow ? "text-trusted" : "text-fg-3"}>
              {protectedNow ? "Protected" : "Starting"}
            </span>
            <span className="text-fg-4">· {transport}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={onOpenActivity}>
            View activity
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>

      <section className="bg-surface rounded-md ring-1 ring-line grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="px-5 py-5 min-w-0">
          <SectionTitle className="mb-4">Trust flow</SectionTitle>
          <TrustGraph nodes={nodes} />
          {degraded && (
            <p className="text-[12px] text-fg-4 mt-2 max-w-[80ch] m-0">
              {degraded}
            </p>
          )}
        </div>

        <div className="px-5 py-5 border-t lg:border-t-0 lg:border-l border-line">
          <SectionTitle className="mb-4">Attack simulation</SectionTitle>
          <AttackRunner
            tools={tools}
            entries={entries}
            onCall={onCall}
            onActive={onActive}
            onInspect={onInspect}
          />
        </div>
      </section>

      {latest ? (
        <DecisionSummary
          entry={latest}
          entries={entries}
          onInspect={() => onInspect(latest)}
          onReplay={() => onReplay(latest)}
        />
      ) : (
        <NoDecisionYet />
      )}
    </div>
  );
}
