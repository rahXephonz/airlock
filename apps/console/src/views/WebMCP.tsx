import type { Capabilities } from '../webmcp/capabilities';
import { Button, Dot, Facts, LABEL, Panel, ViewHeader } from '../ui/primitives';

/**
 * What this browser's WebMCP implementation was measured to do.
 *
 * Every row is the result of a call, not of a user-agent string: ChatGPT's
 * in-app browser reports Chrome 151 and withholds most of the federation
 * surface, so sniffing would get this exactly backwards.
 *
 * The fallback is stated rather than hidden, because the architectural claim
 * depends on it being visible: discovery transport and policy enforcement are
 * separate layers, and only the first one ever degrades.
 */
export function WebMCP({
  capabilities,
  federated,
  publishedCount,
  rereading,
  onReread,
  diagnostic,
}: {
  capabilities: Capabilities;
  federated: boolean;
  publishedCount: number;
  rereading: boolean;
  onReread: () => void;
  diagnostic: string;
}) {
  const c = capabilities;

  const measured: { label: string; ok: boolean; detail: string }[] = [
    {
      label: 'document.modelContext',
      ok: c.present,
      detail: c.present ? 'present' : 'absent — no WebMCP in this browser',
    },
    {
      label: 'registerTool',
      ok: c.canRegister,
      detail: c.canRegister ? 'callable — tools this page publishes are real' : 'unavailable',
    },
    {
      label: 'getTools()',
      ok: c.getToolsAnswered,
      detail: c.getToolsAnswered
        ? `answered with ${c.ownTools.length} own tool${c.ownTools.length === 1 ? '' : 's'}`
        : 'did not answer within the deadline',
    },
    {
      label: 'getTools({ fromOrigins })',
      ok: c.fromOriginsAnswered && c.foreignTools.length > 0,
      detail: !c.fromOriginsAnswered
        ? 'did not answer within the deadline'
        : c.foreignTools.length > 0
          ? `${c.foreignTools.length} ${c.foreignTools.length === 1 ? 'capability' : 'capabilities'} across ${c.foreignOrigins.length} foreign ${c.foreignOrigins.length === 1 ? 'origin' : 'origins'}`
          : 'answered with 0 foreign tools and no error — federation is withheld here',
    },
    {
      label: "addEventListener('toolchange')",
      ok: c.toolchange,
      detail: c.toolchange
        ? 'present — the surface re-discovers itself'
        : 'undefined — re-discovery is on an explicit refresh',
    },
  ];

  return (
    <div>
      <ViewHeader
        title="WebMCP"
        lede="Measured in this browser, by calling each API rather than by reading a version string."
        actions={
          <Button onClick={onReread} disabled={rereading}>
            {rereading ? 'Reading…' : 'Re-read the registry'}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
        <Panel label="Environment">
          <ul className="list-none p-0 m-0 grid gap-2.5">
            {measured.map((r) => (
              <li key={r.label} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3 items-start">
                <span className="mt-[6px]">
                  <Dot tone={r.ok ? 'trusted' : 'neutral'} hollow={!r.ok} />
                </span>
                <div className="min-w-0">
                  <p className={`font-mono text-[12.5px] ${r.ok ? 'text-ink' : 'text-ink-3'}`}>
                    {r.label}
                  </p>
                  <p className="text-ink-3 text-[12px] mt-0.5">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel label="What is real either way">
          <Facts
            rows={[
              ['Transport', federated ? 'Native cross-origin' : 'Fixture resolver'],
              ['Policy engine', 'Real'],
              ['Provenance', 'Real'],
              ['Ledger', 'Real'],
              ['Consent and override', 'Real'],
              ['Mediated capabilities', String(publishedCount)],
            ]}
          />
          <p className="text-ink-3 text-[12px] mt-4 leading-[1.55]">
            Policy is independent of transport. Where cross-origin discovery is withheld the
            partner surface is a stand-in and says so; the engine that classifies origins, tracks
            provenance, refuses the write and records the decision is the same code either way.
          </p>
        </Panel>
      </div>

      {diagnostic && (
        <p className="text-ink-3 text-[12.5px] mt-4 max-w-[80ch]">{diagnostic}</p>
      )}

      <details className="mt-5 group">
        <summary
          className={`${LABEL} cursor-pointer list-none py-2 hover:text-ink
                      marker:content-none focus-visible:text-ink`}
        >
          Registry inspector — {c.ownTools.length} tools registered by this page
        </summary>
        <div className="border border-seam rounded-[3px] p-4 mt-2">
          <p className="text-ink-3 text-[12.5px] max-w-[76ch]">
            These names came out of{' '}
            <code className="font-mono text-ink-2">document.modelContext.getTools()</code>, not
            out of this page&apos;s own state. An agent attached to this tab sees exactly this
            list, and never the partner tools themselves.
          </p>
          {c.ownTools.length === 0 ? (
            <p className="text-ink-3 text-[12.5px] mt-3">
              {c.present
                ? 'The browser reports no tools registered by this page yet.'
                : 'Nothing to read back — this browser has no WebMCP registry.'}
            </p>
          ) : (
            <ul className="flex gap-1.5 flex-wrap mt-3 list-none p-0 m-0">
              {c.ownTools.map((name) => (
                <li key={name}>
                  <code className="font-mono text-[11.5px] text-ink bg-panel-2 border border-seam-2
                                   rounded-[2px] px-2 py-[3px] inline-block break-all">
                    {name}
                  </code>
                </li>
              ))}
            </ul>
          )}
          {c.present && publishedCount > c.ownTools.length && (
            <p className="text-semi text-[12.5px] mt-3 max-w-[74ch]">
              This page published {publishedCount} tools but the browser reports{' '}
              {c.ownTools.length}. The registry, not the page, is the one to believe.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
