import type { Capabilities } from "../webmcp/capabilities";
import { Button, LABEL, PANEL, Tag } from "./primitives";

/**
 * What this browser's WebMCP implementation was measured to do, and which tools
 * it currently holds for this page.
 *
 * This panel exists because the honest answer to "does Airlock work in ChatGPT's
 * in-app browser" is *partly*, and partly is not a claim anyone should have to
 * take on trust. Cross-origin discovery is withheld there, so the tool surface
 * shown above is a stand-in — but `registerTool` is not withheld, and every
 * mediated proxy really is registered. The names below are read back out of
 * `document.modelContext.getTools()` rather than out of this page's own state,
 * so the distinction is checkable instead of asserted.
 */
export function RegistrationPanel({
  capabilities,
  publishedCount,
  onReread,
  rereading,
}: {
  capabilities: Capabilities;
  publishedCount: number;
  onReread: () => void;
  rereading: boolean;
}) {
  const c = capabilities;
  const rows: { label: string; ok: boolean; detail: string }[] = [
    {
      label: "document.modelContext",
      ok: c.present,
      detail: c.present ? "present" : "absent — no WebMCP in this browser",
    },
    {
      label: "registerTool",
      ok: c.canRegister,
      detail: c.canRegister
        ? "callable — tools this page publishes are real"
        : "unavailable",
    },
    {
      label: "getTools()",
      ok: c.getToolsAnswered,
      detail: c.getToolsAnswered
        ? `answered with ${c.ownTools.length} own tool${c.ownTools.length === 1 ? "" : "s"}`
        : "did not answer within the deadline",
    },
    {
      label: "getTools({ fromOrigins })",
      ok: c.fromOriginsAnswered && c.foreignTools.length > 0,
      detail: !c.fromOriginsAnswered
        ? "did not answer within the deadline"
        : c.foreignTools.length > 0
          ? `${c.foreignTools.length} tools across ${c.foreignOrigins.length} foreign origins`
          : "answered with 0 foreign tools and no error — federation is withheld here",
    },
    {
      label: "addEventListener('toolchange')",
      ok: c.toolchange,
      detail: c.toolchange
        ? "present — the surface re-discovers itself"
        : "undefined — re-discovery is on the button above",
    },
  ];

  return (
    <div className={`${PANEL} p-4 sm:p-5`}>
      <div className="flex gap-2.5 items-center flex-wrap justify-between">
        <p className={LABEL}>Measured in this browser</p>
        <Button onClick={onReread} disabled={rereading}>
          {rereading ? "Reading…" : "Re-read the registry"}
        </Button>
      </div>

      <dl className="grid gap-0 mt-3.5 m-0">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,22ch)_1fr] gap-x-4 gap-y-0.5
                       border-t border-seam py-2.5 first:border-t-0 first:pt-0"
          >
            <dt className="font-mono text-[12.5px] text-ink break-words">
              {r.label}
            </dt>
            <dd className="m-0 flex gap-2 items-baseline flex-wrap">
              <Tag tone={r.ok ? "trusted" : "bad"}>{r.ok ? "yes" : "no"}</Tag>
              <span className="text-ink-2 text-[13px]">{r.detail}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className={`${LABEL} mt-5`}>
        Registered by this page, read back from the browser
      </p>
      <p className="text-ink-2 text-[13px] mt-1.5 max-w-[74ch]">
        These names came out of{" "}
        <code className="font-mono text-ink">
          document.modelContext.getTools()
        </code>
        , not out of this page's own state. An agent attached to this tab sees
        exactly this list — and, where cross-origin discovery is withheld, sees
        it anyway. Registration is real on every browser that has WebMCP at all;
        only the transport behind the proxies falls back.
      </p>

      {c.ownTools.length === 0 ? (
        <p className="text-ink-3 text-[13px] mt-3">
          {c.present
            ? "The browser reports no tools registered by this page yet."
            : "Nothing to read back — this browser has no WebMCP registry."}
        </p>
      ) : (
        <ul className="flex gap-1.5 flex-wrap mt-3 list-none p-0 m-0">
          {c.ownTools.map((name) => (
            <li key={name}>
              <code className="font-mono text-[12px] text-ink bg-panel-2 border border-seam-2
                               rounded-[2px] px-2 py-[3px] inline-block break-all">
                {name}
              </code>
            </li>
          ))}
        </ul>
      )}

      {c.present && publishedCount > c.ownTools.length && (
        <p className="text-semi text-[13px] mt-3 max-w-[74ch]">
          This page published {publishedCount} tools but the browser reports{" "}
          {c.ownTools.length}. The registry, not the page, is the one to believe.
        </p>
      )}
    </div>
  );
}
