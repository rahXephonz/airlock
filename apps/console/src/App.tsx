import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ORIGINS,
  TRUST,
  type DiscoveredTool,
  type RawTool,
  type ToolResolver,
} from "@airlock/shared";
import { CrossOriginResolver } from "./webmcp/crossOriginResolver";
import { SimulatedResolver } from "./webmcp/simulatedResolver";
import { Mediator } from "./webmcp/mediation";
import { registerPolicyTools } from "./webmcp/policyTools";
import { modelContext } from "./webmcp/types";
import { Ledger } from "./state/ledger";
import { ConsentQueue } from "./state/consent";
import { Hero } from "./ui/Hero";
import { Scenario } from "./ui/Scenario";
import { ToolCard } from "./ui/ToolCard";
import { ConsentDialog } from "./ui/ConsentDialog";
import { LedgerView } from "./ui/LedgerView";
import { OverrideDialog } from "./ui/OverrideDialog";
import type { LedgerEntry } from "./state/ledger";
import { Button, PANEL, Section, Tag, toneForTrust } from "./ui/primitives";

const PARTNERS = ["vault", "dispatch", "bazaar"] as const;

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
  const [note, setNote] = useState("Discovering tools…");
  const mediator = useRef<Mediator | null>(null);
  /** Stops late-loading frames from restarting discovery that already succeeded. */
  const federated = useRef(false);
  const [reviewing, setReviewing] = useState<LedgerEntry | null>(null);
  /** Frames that failed to load, so an unreachable partner reads as unavailable. */
  const [unreachable, setUnreachable] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [offline] = useState(offlineFromQuery);

  const entries = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot);
  const pending = useSyncExternalStore(consent.subscribe, consent.getSnapshot);

  /**
   * Picks a resolver by what the browser actually produced.
   *
   * Cross-origin discovery resolves with no foreign tools instead of throwing
   * where it is unsupported, so the choice is made on the result rather than on
   * an error that never arrives.
   */
  const chooseResolver = useCallback(async (): Promise<ToolResolver> => {
    if (!modelContext()) return new SimulatedResolver();

    // Partner tools appear only once each iframe has loaded and run its own
    // registerTool calls, which happens after this component mounts. Asking once
    // on mount reliably finds nothing and falls back to the simulated surface on
    // a browser that was perfectly capable of the real one.
    const cross = new CrossOriginResolver();
    for (let attempt = 0; attempt < 12; attempt++) {
      const found = await cross.discover().catch(() => []);
      if (found.length > 0) return cross;
      await new Promise((r) => setTimeout(r, 400));
    }

    // Reports what was actually seen rather than only that nothing was found, so
    // a browser that has WebMCP but withholds cross-origin tools can be told
    // apart from one whose partner frames never loaded.
    const mc = modelContext();
    const empty: RawTool[] = [];
    const deadline = <T,>(work: Promise<T>, fallback: T) =>
      Promise.race([
        work.catch(() => fallback),
        new Promise<T>((r) => setTimeout(() => r(fallback), 1500)),
      ]);
    const everything = mc ? await deadline(mc.getTools(), empty) : empty;
    const withOrigins = mc
      ? await deadline(
          mc.getTools({
            fromOrigins: [ORIGINS.vault, ORIGINS.dispatch, ORIGINS.bazaar],
          }),
          empty,
        )
      : empty;
    const foreign = withOrigins.filter(
      (t) => t.origin && t.origin !== window.location.origin,
    ).length;
    setDiagnostic(
      `getTools() returned ${everything.length}; getTools({ fromOrigins }) returned ` +
        `${withOrigins.length}, of which ${foreign} were foreign.`,
    );
    return new SimulatedResolver();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    // Airlock's own tools describe its decisions and outlive any partner, so
    // they are registered once rather than rebuilt with the proxy surface.
    const policyTools = new AbortController();
    void registerPolicyTools(ledger, policyTools.signal);

    void (async () => {
      const chosen = await chooseResolver();
      if (cancelled) return;

      setResolver(chosen);
      federated.current = chosen.id === "cross-origin";
      const mediatorInstance = new Mediator({
        resolver: chosen,
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
        const found = await chosen.discover().catch(() => []);
        if (cancelled) return;
        setTools(found);

        const origins = new Set(found.map((t) => t.profile?.name)).size;
        // Reported before publishing, so a failure to register proxies cannot
        // leave the page claiming it is still looking for tools it already has.
        setNote(
          chosen.id === "cross-origin"
            ? `Discovered ${found.length} tools across ${origins} partner origins.`
            : modelContext()
              ? "This browser has WebMCP but does not expose tools across origins. Showing a simulated tool surface — the policy engine, consent flow and ledger below are the real ones."
              : "This browser has no WebMCP support. Showing a simulated tool surface — the policy engine, consent flow and ledger below are the real ones.",
        );

        const report = await mediatorInstance.publish(found);
        if (cancelled) return;
        setDiagnostic(
          report.failures.length === 0
            ? `${report.registered} mediated proxies registered. An agent attached to this page sees these and never the partner tools themselves.`
            : `${report.registered} of ${found.length} proxies registered. Failed: ${report.failures.join("; ")}`,
        );
      };

      await refresh();
      // Absent in ChatGPT's in-app browser, where the surface is static anyway.
      unsubscribe = chosen.subscribe(() => void refresh());
    })();

    return () => {
      cancelled = true;
      policyTools.abort();
      unsubscribe();
      // The replacement will claim the same proxy names, so this surface has to
      // go with the mediator that published it.
      mediator.current?.dispose();
    };
  }, [chooseResolver, reloadKey]);

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

  const runPrompt = useCallback(
    async (tool: DiscoveredTool) => {
      const props = (tool.inputSchema.properties ?? {}) as Record<
        string,
        { enum?: unknown[] }
      >;
      const args: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(props)) {
        const suggestion = schema.enum?.[0];
        const value = window.prompt(
          `${tool.name} — ${key}`,
          suggestion ? String(suggestion) : "",
        );
        if (value !== null && value !== "") args[key] = value;
      }
      await call(tool, args);
    },
    [call],
  );

  const federatedNow = resolver?.id === "cross-origin";

  return (
    <div className="max-w-[1060px] mx-auto px-[22px] pb-24">
      <Hero />

      <Section
        label="Origins"
        lede="Trust is Airlock's own judgement of each origin, set here and never moved by anything the origin asserts about itself."
      >
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(224px,1fr))]">
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
        <div className="flex gap-2.5 items-start mb-4">
          <div
            className={`flex-1 rounded-[2px] px-4 py-3 text-sm border ${
              federatedNow
                ? "bg-trusted-dim border-[#2a4c42] text-trusted"
                : "bg-semi-dim border-[#4b3d18] text-semi"
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
            <p className="text-ink-3 text-sm">Nothing discovered yet.</p>
          )}
          {tools.map((t) => (
            <ToolCard
              key={`${t.raw.origin}-${t.name}`}
              tool={t}
              onRun={runPrompt}
            />
          ))}
        </div>
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
          </>
        }
      >
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(286px,1fr))]">
          {PARTNERS.map((name) => (
            <figure key={name} className="m-0">
              <figcaption className="font-mono text-[11.5px] text-ink-3 mb-1.5">
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
                // A frame that finishes loading after discovery gave up is the
                // one case a retry cannot cover, so its arrival triggers another.
                onLoad={() => {
                  setUnreachable((prev) => {
                    if (!prev.has(name)) return prev;
                    const next = new Set(prev);
                    next.delete(name);
                    return next;
                  });
                  if (!federated.current) setReloadKey((k) => k + 1);
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
