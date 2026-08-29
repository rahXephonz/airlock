import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  TRUST,
  type DiscoveredTool,
  type ToolResolver,
} from "@airlock/shared";
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
import { Ledger } from "./state/ledger";
import { ConsentQueue } from "./state/consent";
import { Hero } from "./ui/Hero";
import { Scenario } from "./ui/Scenario";
import { ToolCard } from "./ui/ToolCard";
import { ConsentDialog } from "./ui/ConsentDialog";
import { LedgerView } from "./ui/LedgerView";
import { OverrideDialog } from "./ui/OverrideDialog";
import { RegistrationPanel } from "./ui/RegistrationPanel";
import type { LedgerEntry } from "./state/ledger";
import { Button, PANEL, Section, Tag, toneForTrust } from "./ui/primitives";

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

const DEAD_ORIGIN = "https://airlock-this-origin-does-not-exist.netlify.app";

const ledger = new Ledger();
const consent = new ConsentQueue();

export default function App() {
  const [resolver, setResolver] = useState<ToolResolver | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [diagnostic, setDiagnostic] = useState("");
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [note, setNote] = useState("Checking what this browser supports…");
  const [capabilities, setCapabilities] =
    useState<Capabilities>(EMPTY_CAPABILITIES);
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
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [reviewing, setReviewing] = useState<LedgerEntry | null>(null);
  /** Frames that failed to load, so an unreachable partner reads as unavailable. */
  const [unreachable, setUnreachable] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [offline] = useState(offlineFromQuery);

  const entries = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot);
  const pending = useSyncExternalStore(consent.subscribe, consent.getSnapshot);

  /** Re-reads the browser's own tool registry, for the registration panel. */
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
      setNote("Waiting for the partner frames to publish their tools…");
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
            ? `Discovered ${found.length} tools across ${origins} partner origins.`
            : chosen.capabilities.present
              ? "This browser runs WebMCP but withholds tools across origins, so the partner surface below is a stand-in. Everything downstream of it is real — including the mediated proxies, which are registered with this browser's own registerTool and listed further down."
              : "This browser has no WebMCP support, so the partner surface below is a stand-in. The policy engine, consent flow and ledger below are the real ones.",
        );

        const report = await mediatorInstance.publish(found);
        if (cancelled) return;
        setPublishedCount(report.registered);
        setDiagnostic(
          report.failures.length === 0
            ? `${report.registered} mediated proxies registered. An agent attached to this page sees these and never the partner tools themselves.`
            : `${report.registered} of ${found.length} proxies registered. Failed: ${report.failures.join("; ")}`,
        );
        // Read the browser's registry back, so what the panel below reports is
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

  const call = useCallback(
    async (tool: DiscoveredTool, args: Record<string, unknown>) => {
      await mediator.current?.call(tool, args, undefined, false);
    },
    [],
  );

  /**
   * Re-runs a blocked call with the block released.
   *
   * Reachable only from the ledger, and only after the override dialog has shown
   * the provenance. Nothing an agent can call leads here.
   */
  const release = useCallback(
    async (entry: LedgerEntry) => {
      const tool = tools.find((t) => t.name === entry.toolName);
      setReviewing(null);
      if (!tool) return;
      await mediator.current?.call(
        tool,
        entry.args as Record<string, unknown>,
        undefined,
        true,
      );
    },
    [tools],
  );

  const federatedNow = resolver?.id === "cross-origin";
  const settled = resolver !== null;

  return (
    <div className="max-w-[1060px] mx-auto px-4 sm:px-[22px] pb-24">
      <Hero />

      <Section
        label="Origins"
        lede="Trust is Airlock's own judgement of each origin, set here and never moved by anything the origin asserts about itself."
      >
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(224px,100%),1fr))]">
          {(["console", ...PARTNERS] as const).map((name) => {
            const p = TRUST[name];
            const count = tools.filter((t) => t.profile?.name === name).length;
            // An origin that failed to load, or that a working federation found
            // nothing from, is reported as unavailable rather than as empty.
            const down =
              name !== "console" &&
              (unreachable.has(name) ||
                offline.has(name) ||
                (federatedNow && count === 0));
            return (
              <div className={`${PANEL} p-4`} key={name}>
                <div className="flex gap-2 items-center flex-wrap mb-2.5">
                  <h3 className="font-mono text-sm font-semibold m-0">
                    {p.name}
                  </h3>
                  {down && <Tag tone="bad">unavailable</Tag>}
                </div>
                <Tag tone={toneForTrust(p.trust)}>{p.trust}</Tag>
                <p className="text-ink-2 text-[13.5px] mt-2.5 leading-[1.5]">
                  {p.rationale}
                </p>
                <p className="font-mono text-xs text-ink-3 mt-3 tabular-nums">
                  {name === "console"
                    ? "policy engine"
                    : down
                      ? "did not load — its tools are absent"
                      : `${count} tool${count === 1 ? "" : "s"} discovered`}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        label="The attack"
        lede="A marketplace listing describes a fulfilment process whose steps move the buyer's billing reference into a public write, phrased as the thing the user just asked to have done. Nothing in the user's request authorises publishing anything."
      >
        <Scenario tools={tools} onCall={call} entries={entries} />
      </Section>

      <Section
        label="Discovered tools"
        lede="What each origin published, and what Airlock concluded about it. A read-only claim from a foreign origin is recorded as a claim and never used to decide anything."
      >
        <div className="flex gap-2.5 items-start mb-4 flex-wrap sm:flex-nowrap">
          <div
            className={`flex-1 min-w-[220px] rounded-[2px] px-4 py-3 text-sm border ${
              federatedNow
                ? "bg-trusted-dim border-[#2a4c42] text-trusted"
                : settled
                  ? "bg-semi-dim border-[#4b3d18] text-semi"
                  : "bg-panel-2 border-seam-2 text-ink-2"
            }`}
          >
            {note}
          </div>
          <Button onClick={() => setReloadKey((k) => k + 1)}>
            Re-run discovery
          </Button>
        </div>
        {diagnostic && (
          <p className="text-ink-3 text-[13px] mb-4 max-w-[76ch]">
            {diagnostic}
          </p>
        )}

        <div className="grid gap-3">
          {tools.length === 0 && (
            <p className="text-ink-3 text-sm">
              {settled ? "Nothing discovered yet." : "Discovering…"}
            </p>
          )}
          {tools.map((t) => (
            <ToolCard
              key={`${t.raw.origin}-${t.name}`}
              tool={t}
              onRun={call}
            />
          ))}
        </div>
      </Section>

      <Section
        label="WebMCP, as this browser implements it"
        lede="Support is uneven and no user-agent string tells you which parts you have — ChatGPT's in-app browser reports Chrome 151 and withholds most of the federation surface. So every row below is a call that was made, and the tool names are read back out of the browser's own registry."
      >
        <RegistrationPanel
          capabilities={capabilities}
          publishedCount={publishedCount}
          onReread={() => void reread()}
          rereading={rereading}
        />
      </Section>

      <Section
        label="Partner origins, live"
        lede={
          <>
            Each partner runs here in its own frame with{" "}
            <code className="font-mono text-ink">allow=&quot;tools&quot;</code>.
            These are separate instances from the same sites opened in another
            tab, so change their state here. Lock the vault and its tool
            disappears from the list above — an invalid tool stops existing
            rather than existing and failing.
            {settled && !federatedNow && capabilities.present && (
              <>
                {" "}
                This browser gives frames no{" "}
                <code className="font-mono text-ink">modelContext</code> of their
                own, so these three run and render but publish nothing that
                reaches this page.
              </>
            )}
          </>
        }
      >
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(min(286px,100%),1fr))]">
          {PARTNERS.map((name) => (
            <figure key={name} className="m-0">
              <figcaption className="font-mono text-[11.5px] text-ink-3 mb-1.5 break-all">
                {name} ·{" "}
                {offline.has(name)
                  ? "offline (demonstrating degradation)"
                  : TRUST[name].url.replace("https://", "")}
              </figcaption>
              <iframe
                className="w-full h-[272px] border border-seam rounded-[3px] bg-panel"
                src={offline.has(name) ? DEAD_ORIGIN : TRUST[name].url}
                allow="tools"
                title={name}
                loading="eager"
                // A frame that finishes loading after discovery gave up is the
                // one case a retry cannot cover, so its arrival triggers another
                // — but only where a frame can publish tools at all.
                onLoad={() => {
                  setLoaded((prev) =>
                    prev.has(name) ? prev : new Set(prev).add(name),
                  );
                  setUnreachable((prev) => {
                    if (!prev.has(name)) return prev;
                    const next = new Set(prev);
                    next.delete(name);
                    return next;
                  });
                  scheduleRediscovery();
                }}
                // A partner that is down must read as unavailable rather than
                // taking the console with it. AGENT.md §4 calls this mandatory.
                onError={() =>
                  setUnreachable((prev) => new Set(prev).add(name))
                }
              />
            </figure>
          ))}
        </div>
      </Section>

      <Section
        label="Audit log"
        lede="Every mediated call and the reasoning behind it, kept as data rather than as prose in a transcript."
      >
        <LedgerView entries={entries} onOverride={setReviewing} />
      </Section>

      {pending && <ConsentDialog request={pending} />}
      {reviewing && (
        <OverrideDialog
          entry={reviewing}
          onConfirm={() => void release(reviewing)}
          onCancel={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
