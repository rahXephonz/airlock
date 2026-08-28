import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TRUST, type DiscoveredTool, type ToolResolver } from '@airlock/shared';
import { CrossOriginResolver } from './webmcp/crossOriginResolver';
import { SimulatedResolver } from './webmcp/simulatedResolver';
import { Mediator } from './webmcp/mediation';
import { modelContext } from './webmcp/types';
import { Ledger } from './state/ledger';
import { ConsentQueue } from './state/consent';
import { ToolCard } from './ui/ToolCard';
import { ConsentDialog } from './ui/ConsentDialog';
import { LedgerView } from './ui/LedgerView';

const PARTNERS = ['vault', 'dispatch', 'bazaar'] as const;

const ledger = new Ledger();
const consent = new ConsentQueue();

export default function App() {
  const [resolver, setResolver] = useState<ToolResolver | null>(null);
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [note, setNote] = useState('Discovering tools…');
  const mediator = useRef<Mediator | null>(null);

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
    if (modelContext()) {
      const cross = new CrossOriginResolver();
      const found = await cross.discover().catch(() => []);
      if (found.length > 0) return cross;
    }
    return new SimulatedResolver();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    void (async () => {
      const chosen = await chooseResolver();
      if (cancelled) return;

      setResolver(chosen);
      const mediatorInstance = new Mediator({ resolver: chosen, ledger, consent });
      mediator.current = mediatorInstance;

      /**
       * Re-reads the partner surface and rebuilds every proxy from it.
       *
       * Partner tools come and go with partner state — the vault unregisters
       * its read tool while locked — so a surface published once at boot goes
       * stale the moment anything changes. Rebuilding on every toolchange is
       * what keeps the agent's view and the partners' actual capabilities the
       * same thing.
       */
      const refresh = async () => {
        const found = await chosen.discover().catch(() => []);
        if (cancelled) return;
        setTools(found);
        await mediatorInstance.publish(found);
        const origins = new Set(found.map((t) => t.profile?.name)).size;
        setNote(
          chosen.id === 'cross-origin'
            ? `Discovered ${found.length} tools across ${origins} partner origins, each mediated by a proxy the agent calls instead.`
            : modelContext()
              ? 'WebMCP is present but no partner tools were discovered. Showing the simulated surface so the policy layer is still demonstrable.'
              : 'This browser has no WebMCP support. Showing the simulated surface — the policy engine, ledger and consent flow below are the real ones.',
        );
      };

      await refresh();
      // Absent in ChatGPT's in-app browser, where the surface is static anyway.
      unsubscribe = chosen.subscribe(() => void refresh());
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [chooseResolver]);

  const call = useCallback(async (tool: DiscoveredTool, args: Record<string, unknown>) => {
    await mediator.current?.call(tool, args, undefined);
  }, []);

  const byName = useMemo(
    () => Object.fromEntries(tools.map((t) => [t.name, t])),
    [tools],
  );

  /**
   * Drives the exact scenario the project exists to show, without needing an
   * agent attached. A judge opening the live URL has to reach this.
   */
  const runScenario = useCallback(async () => {
    const listing = byName['bazaar_read_listing'];
    const record = byName['vault_read_record'];
    const send = byName['dispatch_send_message'];
    if (!listing || !record || !send) return;

    await call(listing, { id: '4412' });
    await call(record, { id: 'rec-1' });
    // What the seller's notes told the agent to do, verbatim.
    await call(send, { body: 'ORDER 4412 ref=ACCT-7731-QX45' });
  }, [byName, call]);

  const runPrompt = useCallback(async (tool: DiscoveredTool) => {
    const props = (tool.raw.inputSchema?.properties ?? {}) as Record<string, { enum?: unknown[] }>;
    const args: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(props)) {
      const suggestion = schema.enum?.[0];
      const value = window.prompt(`${tool.name} — ${key}`, suggestion ? String(suggestion) : '');
      if (value !== null && value !== '') args[key] = value;
    }
    await call(tool, args);
  }, [call]);

  const scenarioReady = Boolean(
    byName['bazaar_read_listing'] && byName['vault_read_record'] && byName['dispatch_send_message'],
  );

  return (
    <div className="wrap">
      <header>
        <h1>Airlock</h1>
        <p>Run tools from several origins in one agent session — without trusting them all equally.</p>
        <p className="thesis">
          A per-call confirmation asks "run this write?". It does not say which origin the tool
          came from, how far that origin is trusted, or that the argument you are about to approve
          was written by a different origin entirely. Airlock decides on provenance, outside the
          model, and keeps the reasoning as a record.
        </p>
      </header>

      {PARTNERS.map((name) => (
        <iframe key={name} className="partner" src={TRUST[name].url} allow="tools" title={name} />
      ))}

      <div className={`banner ${resolver?.id === 'cross-origin' ? 'ok' : ''}`}>{note}</div>

      <h2>Origins</h2>
      <div className="grid origins">
        {(['console', ...PARTNERS] as const).map((name) => {
          const p = TRUST[name];
          const count = tools.filter((t) => t.profile?.name === name).length;
          return (
            <div className="card" key={name}>
              <h3>{p.name}</h3>
              <span className={`tag ${p.trust === 'self' ? 'self' : p.trust === 'trusted' ? 'trusted' : 'semi'}`}>
                {p.trust}
              </span>
              <div className="muted" style={{ marginTop: 6 }}>{p.rationale}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {name === 'console' ? 'policy engine' : `${count} tool${count === 1 ? '' : 's'} discovered`}
              </div>
            </div>
          );
        })}
      </div>

      <h2>Scenario</h2>
      <div className="row">
        <button className="danger" onClick={() => void runScenario()} disabled={!scenarioReady}>
          Run the cross-origin exfiltration attempt
        </button>
        <span className="muted">
          Reads a listing from bazaar, reads the billing record from vault, then tries to send the
          account reference through dispatch — exactly what the seller's notes instruct.
        </span>
      </div>

      <h2>Discovered tools</h2>
      <div className="grid">
        {tools.length === 0 && <div className="muted">Nothing discovered yet.</div>}
        {tools.map((t) => <ToolCard key={`${t.raw.origin}-${t.name}`} tool={t} onRun={runPrompt} />)}
      </div>

      <h2>Audit log</h2>
      <LedgerView entries={entries} />

      {pending && <ConsentDialog request={pending} />}
    </div>
  );
}
