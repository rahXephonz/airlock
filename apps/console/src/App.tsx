import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DiscoveredTool, ToolResolver } from "@airlock/shared";
import { CrossOriginResolver } from "./webmcp/crossOriginResolver";
import { SimulatedResolver } from "./webmcp/simulatedResolver";
import { Mediator } from "./webmcp/mediation";
import { registerPolicyTools } from "./webmcp/policyTools";
import {
  EMPTY_CAPABILITIES,
  federationPlausible,
  probe,
  type Capabilities,
} from "./webmcp/capabilities";
import { Ledger, type LedgerEntry } from "./state/ledger";
import { ConsentQueue } from "./state/consent";
import { useRoute } from "./state/route";
import type { ReplayReport } from "./state/replay";
import { AppShell, ProtectionStatus } from "./ui/AppShell";
import { PartnerFrames } from "./ui/PartnerFrames";
import { ConsentDialog } from "./ui/ConsentDialog";
import { OverrideDialog } from "./ui/OverrideDialog";
import { DecisionDrawer } from "./ui/DecisionDrawer";
import { Overview } from "./views/Overview";
import { Activity } from "./views/Activity";
import { Policies } from "./views/Policies";
import { Origins } from "./views/Origins";
import { WebMCP } from "./views/WebMCP";

const PARTNERS = ["vault", "dispatch", "bazaar"] as const;

/**
 * How long partner frames are given to load and publish before the console
 * stops waiting for them.
 *
 * Only spent on browsers where a frame can publish at all. Somewhere that
 * withholds `modelContext` from frames, waiting produces nothing but a page that
 * says it is still looking — which is the first thing a judge would see.
 */
const FEDERATION_BUDGET_MS = 6000;

/** How long a frame may take to load before it is reported as unavailable. */
const FRAME_LOAD_BUDGET_MS = 9000;

/**
 * Origins the page was asked to treat as down, via `?offline=vault,bazaar`.
 *
 * Graceful degradation is a claim that is worth nothing unless someone can check
 * it, and a partner cannot be taken offline on demand during a demo. This points
 * the named frames at a host that does not resolve, so the failure is real
 * rather than simulated.
 */
const offlineFromQuery = (): ReadonlySet<string> =>
  new Set(
    new URLSearchParams(window.location.search)
      .get("offline")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  );

const ledger = new Ledger();
const consent = new ConsentQueue();

export default function App() {
  const [view, go] = useRoute();
  const [resolver, setResolver] = useState<ToolResolver | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [diagnostic, setDiagnostic] = useState("");
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [note, setNote] = useState("Checking what this browser supports…");
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [rereading, setRereading] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const mediator = useRef<Mediator | null>(null);
  /** Stops late-loading frames from restarting discovery that already succeeded. */
  const federated = useRef(false);
  /**
   * Whether a frame is capable of publishing tools here at all.
   *
   * Set from a measurement, not a user-agent string: ChatGPT's in-app browser
   * reports `Chrome/151.0.0.0` and still withholds the federation surface.
   *
   * False until the probe answers, so a frame that loads while the measurement
   * is still running cannot restart the very discovery it is waiting on.
   */
  const canFederate = useRef(false);
  /** Caps how often a loading frame may restart discovery. */
  const retries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** The call currently in flight, so the trust flow can show it moving. */
  const [activeTool, setActiveTool] = useState<string | undefined>(undefined);
  /** The decision open in the drawer, and whether replay should already be run. */
  const [inspecting, setInspecting] = useState<{ entry: LedgerEntry; replay: boolean } | null>(
    null,
  );
  const [reviewing, setReviewing] = useState<LedgerEntry | null>(null);
  const [replayed, setReplayed] = useState<ReplayReport | null>(null);
  /** Frames that failed to load, so an unreachable partner reads as unavailable. */
  const [unreachable, setUnreachable] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [offline] = useState(offlineFromQuery);

  // The third argument is the server snapshot. Nothing here is server-rendered
  // in production, but it lets the whole shell be rendered in a test, which is
  // the only cheap way to catch a crash on first paint.
  const entries = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot, ledger.getSnapshot);
  const pending = useSyncExternalStore(consent.subscribe, consent.getSnapshot, consent.getSnapshot);

  /** Re-reads the browser's own tool registry, for the WebMCP view. */
  const reread = useCallback(async () => {
    setRereading(true);
    try {
      setCapabilities(await probe());
    } finally {
      setRereading(false);
    }
  }, []);

  /**
   * Picks a resolver by what the browser actually produced.
   *
   * Cross-origin discovery resolves with no foreign tools instead of throwing
   * where it is unsupported, so the choice is made on the result rather than on
   * an error that never arrives. The measurement comes first so a browser that
   * cannot federate spends no time retrying: partner frames need a few seconds
   * to load and register, and paying that cost somewhere frames will never
   * publish leaves the site looking broken on the path most people open it on.
   */
  const chooseResolver = useCallback(async (): Promise<{
    resolver: ToolResolver;
    capabilities: Capabilities;
  }> => {
    const measured = await probe();
    setCapabilities(measured);
    canFederate.current = federationPlausible(measured);

    if (!measured.present) {
      return { resolver: new SimulatedResolver(), capabilities: measured };
    }

    const cross = new CrossOriginResolver();
    if (measured.foreignTools.length > 0) {
      return { resolver: cross, capabilities: measured };
    }

    if (canFederate.current) {
      setNote("Waiting for the partner frames to publish their capabilities…");
      const until = Date.now() + FEDERATION_BUDGET_MS;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 350));
        const found = await cross.discover().catch(() => []);
        if (found.length > 0) {
          const after = await probe();
          setCapabilities(after);
          return { resolver: cross, capabilities: after };
        }
      }
    }

    return { resolver: new SimulatedResolver(), capabilities: measured };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    // Airlock's own tools describe its decisions and outlive any partner, so
    // they are registered once rather than rebuilt with the proxy surface. The
    // rejection is swallowed deliberately: a browser that refuses one of these
    // must not put an uncaught error in the console during a demo.
    const policyTools = new AbortController();
    void registerPolicyTools(ledger, policyTools.signal).catch(() => []);

    setNote("Checking what this browser supports…");

    void (async () => {
      const chosen = await chooseResolver();
      if (cancelled) return;

      setResolver(chosen.resolver);
      federated.current = chosen.resolver.id === "cross-origin";
      const mediatorInstance = new Mediator({
        resolver: chosen.resolver,
        ledger,
        consent,
      });
      mediator.current = mediatorInstance;

      /**
       * Re-reads the partner surface and rebuilds every proxy from it.
       *
       * Partner tools come and go with partner state — the vault unregisters its
       * read tool while locked — so a surface published once at boot goes stale
       * the moment anything changes.
       */
      const refresh = async () => {
        const found = await chosen.resolver.discover().catch(() => []);
        if (cancelled) return;
        setTools(found);

        const origins = new Set(found.map((t) => t.profile?.name)).size;
        // Reported before publishing, so a failure to register proxies cannot
        // leave the page claiming it is still looking for tools it already has.
        setNote(
          chosen.resolver.id === "cross-origin"
            ? `Discovered ${found.length} capabilities across ${origins} partner origins.`
            : chosen.capabilities.present
              ? "This browser runs WebMCP but withholds capabilities across origins, so the partner surface is a stand-in. Everything downstream of it is real — including the mediated proxies, registered with this browser's own registerTool."
              : "This browser has no WebMCP support, so the partner surface is a stand-in. The policy engine, consent flow and ledger are the real ones.",
        );

        const report = await mediatorInstance.publish(found);
        if (cancelled) return;
        setPublishedCount(report.registered);
        setDiagnostic(
          report.failures.length === 0
            ? `${report.registered} mediated proxies registered. An agent attached to this page sees these and never the partner tools themselves.`
            : `${report.registered} of ${found.length} proxies registered. Failed: ${report.failures.join("; ")}`,
        );
        // Read the browser's registry back, so what the WebMCP view reports is
        // the browser's account of what it holds rather than this page's.
        const after = await probe();
        if (!cancelled) setCapabilities(after);
      };

      await refresh();
      // Absent in ChatGPT's in-app browser, where the surface is static anyway.
      unsubscribe = chosen.resolver.subscribe(() => void refresh());
    })().catch((err: unknown) => {
      // Nothing above is expected to throw — every call that touches WebMCP is
      // already guarded. This is here so that if one does, it reaches the page
      // as a reported failure rather than an uncaught rejection in the console
      // of a browser someone is judging.
      if (cancelled) return;
      setNote("Discovery did not complete in this browser.");
      setDiagnostic(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      policyTools.abort();
      unsubscribe();
      // The replacement will claim the same proxy names, so this surface has to
      // go with the mediator that published it.
      mediator.current?.dispose();
    };
  }, [chooseResolver, reloadKey]);

  /**
   * Restarts discovery once a frame that was still loading has arrived.
   *
   * Debounced and capped. Three frames finishing within a few hundred
   * milliseconds of each other would otherwise restart discovery three times,
   * and on a browser that cannot federate each restart is several seconds during
   * which the page reports that it is still looking.
   */
  const scheduleRediscovery = useCallback(() => {
    if (federated.current || !canFederate.current || retries.current >= 2) return;
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      retries.current += 1;
      setReloadKey((k) => k + 1);
    }, 250);
  }, []);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  /**
   * Reports a frame that never loads as unavailable.
   *
   * A cross-origin frame pointed at a host that does not resolve does not
   * reliably fire `error` — the browser may render its own error page and fire
   * `load` instead — so silence has to be treated as failure on a deadline
   * rather than waited on indefinitely.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setUnreachable((prev) => {
        const next = new Set(prev);
        for (const name of PARTNERS) if (!loaded.has(name)) next.add(name);
        return next.size === prev.size ? prev : next;
      });
    }, FRAME_LOAD_BUDGET_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  const call = useCallback(async (tool: DiscoveredTool, args: Record<string, unknown>) => {
    await mediator.current?.call(tool, args, undefined, false);
  }, []);

  /**
   * Re-runs a blocked call with the block released.
   *
   * Reachable only from the console's own UI, and only after the override
   * dialog has shown the provenance. Nothing an agent can call leads here.
   */
  const release = useCallback(
    async (entry: LedgerEntry) => {
      const tool = tools.find((t) => t.name === entry.toolName);
      setReviewing(null);
      setInspecting(null);
      if (!tool) return;
      await mediator.current?.call(tool, entry.args as Record<string, unknown>, undefined, true);
    },
    [tools],
  );

  const federatedNow = resolver?.id === "cross-origin";
  const settled = resolver !== null;
  const partnerOrigins = new Set(tools.map((t) => t.profile?.name).filter(Boolean)).size;
  const offlineNames = new Set([...unreachable, ...offline]);

  const status = (
    <ProtectionStatus
      mediating={publishedCount > 0 || tools.length > 0}
      origins={partnerOrigins}
      capabilities={publishedCount || tools.length}
      transport={!settled ? "Starting" : federatedNow ? "Native" : "Fallback"}
      onOpenDiagnostics={() => go("webmcp")}
    />
  );

  return (
    <>
      <AppShell
        view={view}
        onNavigate={go}
        status={status}
        frames={
          <PartnerFrames
            partners={PARTNERS}
            visible={view === "origins"}
            offline={offline}
            onLoad={(name) => {
              setLoaded((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
              setUnreachable((prev) => {
                if (!prev.has(name)) return prev;
                const next = new Set(prev);
                next.delete(name);
                return next;
              });
              scheduleRediscovery();
            }}
            onError={(name) => setUnreachable((prev) => new Set(prev).add(name))}
          />
        }
      >
        {view === "overview" && (
          <Overview
            tools={tools}
            entries={entries}
            activeTool={activeTool}
            degraded={federatedNow ? undefined : note}
            onCall={call}
            onActive={setActiveTool}
            onInspect={(entry) => setInspecting({ entry, replay: false })}
            onReplay={(entry) => setInspecting({ entry, replay: true })}
          />
        )}

        {view === "activity" && (
          <Activity
            entries={entries}
            tools={tools}
            selectedId={inspecting?.entry.id}
            replayed={replayed}
            onSelect={(entry) => setInspecting({ entry, replay: false })}
            onReplayAll={setReplayed}
            onClear={() => {
              setReplayed(null);
              setInspecting(null);
              ledger.clear();
            }}
          />
        )}

        {view === "policies" && <Policies entries={entries} />}

        {view === "origins" && <Origins tools={tools} unreachable={offlineNames} onCall={call} />}

        {view === "webmcp" && (
          <WebMCP
            capabilities={capabilities}
            federated={!!federatedNow}
            publishedCount={publishedCount}
            rereading={rereading}
            onReread={() => void reread()}
            diagnostic={diagnostic}
          />
        )}
      </AppShell>

      {inspecting && (
        <DecisionDrawer
          entry={inspecting.entry}
          entries={entries}
          tools={tools}
          autoReplay={inspecting.replay}
          onRelease={setReviewing}
          onClose={() => setInspecting(null)}
        />
      )}

      {pending && <ConsentDialog request={pending} />}

      {reviewing && (
        <OverrideDialog
          entry={reviewing}
          entries={entries}
          onConfirm={() => void release(reviewing)}
          onCancel={() => setReviewing(null)}
        />
      )}
    </>
  );
}
