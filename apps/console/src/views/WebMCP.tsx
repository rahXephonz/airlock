import { useState } from "react";
import {
  CheckCircle2,
  CircleMinus,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { Capabilities } from "../webmcp/capabilities";
import { Sheet } from "../ui/Sheet";
import {
  Badge,
  Button,
  EmptyState,
  Facts,
  SectionTitle,
  ViewHeader,
} from "../ui/primitives";

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

/** The refresh glyph, turning while the measurement is in flight. */
const Spinner = ({ className = "" }: { className?: string | undefined }) => (
  <Loader2 className={`${className} animate-spin`} />
);

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
  lastRead,
  onReread,
  diagnostic,
}: {
  capabilities: Capabilities;
  federated: boolean;
  publishedCount: number;
  rereading: boolean;
  /** When the registry was last read back from the browser. */
  lastRead?: number | undefined;
  onReread: () => void;
  diagnostic: string;
}) {
  const c = capabilities;
  const [registryOpen, setRegistryOpen] = useState(false);

  const measured: { label: string; ok: boolean; detail: string }[] = [
    {
      label: "document.modelContext",
      ok: c.present,
      detail: c.present ? "Present" : "Absent — no WebMCP in this browser",
    },
    {
      label: "registerTool",
      ok: c.canRegister,
      detail: c.canRegister
        ? "Supported — tools this page publishes are real"
        : "Unavailable",
    },
    {
      label: "getTools()",
      ok: c.getToolsAnswered,
      detail: c.getToolsAnswered
        ? `${c.ownTools.length} tool${c.ownTools.length === 1 ? "" : "s"} registered by this page`
        : "No answer within the deadline",
    },
    {
      label: "getTools({ fromOrigins })",
      ok: c.fromOriginsAnswered && c.foreignTools.length > 0,
      detail: !c.fromOriginsAnswered
        ? "No answer within the deadline"
        : c.foreignTools.length > 0
          ? `${c.foreignTools.length} ${c.foreignTools.length === 1 ? "capability" : "capabilities"} across ${c.foreignOrigins.length} foreign ${c.foreignOrigins.length === 1 ? "origin" : "origins"}`
          : "Answered with 0 foreign tools and no error — federation is withheld here",
    },
    {
      label: "addEventListener('toolchange')",
      ok: c.toolchange,
      detail: c.toolchange
        ? "Supported — the surface re-discovers itself"
        : "Undefined — re-discovery is on an explicit refresh",
    },
  ];

  return (
    <div>
      <ViewHeader
        title="WebMCP"
        lede="Measured in this browser by calling each API, not by reading a version string."
        actions={
          <span className="flex items-center gap-3">
            {lastRead !== undefined && (
              <span className="font-mono text-[11.5px] text-fg-4 tabular-nums">
                read {clock(lastRead)}
              </span>
            )}
            <Button
              size="sm"
              icon={rereading ? Spinner : RefreshCw}
              onClick={onReread}
              disabled={rereading}
            >
              {rereading ? "Reading" : "Re-read registry"}
            </Button>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="bg-surface rounded-md ring-1 ring-line px-5 py-5">
          <SectionTitle className="mb-4">Environment</SectionTitle>
          <ul className="list-none p-0 m-0 grid gap-3.5">
            {measured.map((r) => (
              <li key={r.label} className="flex gap-3 items-start">
                {r.ok ? (
                  <CheckCircle2
                    className="size-4 text-trusted shrink-0 mt-px"
                    aria-hidden
                  />
                ) : (
                  <CircleMinus
                    className="size-4 text-fg-4 shrink-0 mt-px"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-mono text-[12.5px] m-0 ${r.ok ? "text-fg" : "text-fg-3"}`}
                  >
                    {r.label}
                  </p>
                  <p className="text-[12.5px] text-fg-3 mt-0.5 m-0">
                    {r.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {diagnostic && (
            <p className="flex gap-2 text-[12px] text-fg-4 mt-5 pt-4 border-t border-line m-0">
              <Info className="size-3.5 shrink-0 mt-px" aria-hidden />
              {diagnostic}
            </p>
          )}
        </div>

        <div className="grid gap-6">
          <div className="bg-surface rounded-md ring-1 ring-line px-5 py-5">
            <SectionTitle className="mb-4">Runtime</SectionTitle>
            <Facts
              rows={[
                [
                  "Transport",
                  <Badge key="t" tone={federated ? "trusted" : "semi"}>
                    {federated ? "Native cross-origin" : "Fixture resolver"}
                  </Badge>,
                ],
                ["Policy engine", "Real"],
                ["Provenance", "Real"],
                ["Ledger", "Real"],
                ["Consent", "Real"],
              ]}
            />
            <p className="text-[12px] text-fg-3 mt-4 leading-[1.6] m-0">
              Policy is independent of transport. Where cross-origin discovery
              is withheld the partner surface is a stand-in and says so; the
              engine that classifies origins, tracks provenance, refuses the
              write and records the decision is the same code either way.
            </p>
          </div>

          <div className="bg-surface rounded-md ring-1 ring-line px-5 py-5">
            <SectionTitle className="mb-3">Registry</SectionTitle>
            <p className="text-[12.5px] text-fg-3 m-0">
              {c.ownTools.length} {c.ownTools.length === 1 ? "tool" : "tools"}{" "}
              registered by this page. An agent attached to this tab sees
              exactly these, and never the partner tools themselves.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => setRegistryOpen(true)}
            >
              View {c.ownTools.length} registered{" "}
              {c.ownTools.length === 1 ? "tool" : "tools"}
            </Button>
          </div>
        </div>
      </div>

      {registryOpen && (
        <Sheet
          onClose={() => setRegistryOpen(false)}
          title="Registry"
          subtitle="Read back from document.modelContext.getTools()"
        >
          {c.ownTools.length === 0 ? (
            <EmptyState
              title={
                c.present
                  ? "No tools registered yet"
                  : "No WebMCP registry in this browser"
              }
              detail={
                c.present
                  ? "Airlock publishes its proxies once discovery settles."
                  : "The policy engine, ledger and consent flow still run; only registration is unavailable."
              }
            />
          ) : (
            <ul className="list-none p-0 m-0 grid gap-1.5">
              {c.ownTools.map((name) => (
                <li
                  key={name}
                  className="font-mono text-[12.5px] text-fg-2 bg-surface-2 rounded-sm px-3 py-2 break-all"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}

          {c.present && publishedCount > c.ownTools.length && (
            <p className="text-[12.5px] text-semi mt-4 m-0">
              This page published {publishedCount} tools but the browser reports{" "}
              {c.ownTools.length}. The registry, not the page, is the one to
              believe.
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}
