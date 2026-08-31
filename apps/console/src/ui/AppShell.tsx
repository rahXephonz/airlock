import type { ReactNode } from "react";
import {
  Activity,
  Blocks,
  LayoutDashboard,
  Network,
  ShieldCheck,
} from "lucide-react";
import { VIEWS, VIEW_LABELS, type View } from "../state/route";
import { Badge, Dot } from "./primitives";

const ICONS: Record<View, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  activity: Activity,
  policies: ShieldCheck,
  origins: Network,
  webmcp: Blocks,
};

/**
 * The Airlock mark.
 *
 * The supplied artwork rather than a drawn glyph: white line work on
 * transparency, so it sits on the rail without a plate behind it. Sized in `rem`
 * and `object-contain` so a future asset with different proportions cannot
 * stretch.
 */
function Mark() {
  return (
    <img
      src="/images/airlock-logo.png"
      alt=""
      width={32}
      height={32}
      className="size-8 object-contain shrink-0"
    />
  );
}

/**
 * The control-plane shell.
 *
 * Five views on one rail, the protection state pinned to the bottom of it, and
 * a content column that stops at a readable width instead of stretching to
 * whatever the display happens to be.
 */
export function AppShell({
  view,
  onNavigate,
  status,
  children,
  frames,
}: {
  view: View;
  onNavigate: (next: View) => void;
  status: ReactNode;
  children: ReactNode;
  /**
   * The partner iframes.
   *
   * Rendered by the shell rather than by the Origins view, because unmounting
   * them would tear down the very tool surface the console is federating: their
   * `registerTool` calls happen on load, and a frame that remounts on every
   * navigation would drop and republish the whole surface. They stay in the
   * tree for the life of the session and are moved off-screen instead.
   */
  frames: ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-3 focus:px-3
                   focus:py-2 focus:bg-surface-2 focus:rounded-sm focus:text-[13px]"
      >
        Skip to content
      </a>

      <header
        className="lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r
                         border-line flex lg:flex-col gap-2 lg:gap-0 items-center lg:items-stretch
                         px-3 lg:px-4 py-3 lg:py-5"
      >
        <div className="flex items-center gap-2.5 lg:mb-6 shrink-0">
          <Mark />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold">Airlock</span>
            <span className="hidden lg:block text-[12px] text-fg-2 mt-1">
              WebMCP security
            </span>
          </span>
        </div>

        <nav
          aria-label="Views"
          className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible min-w-0"
        >
          {VIEWS.map((v) => {
            const Icon = ICONS[v];
            const active = v === view;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onNavigate(v)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 text-[14px] rounded-md px-3 h-9 cursor-pointer",
                  "transition-colors duration-150 whitespace-nowrap",
                  active
                    ? "bg-surface-2 text-fg font-medium"
                    : "text-fg-3 hover:text-fg hover:bg-surface/70",
                ].join(" ")}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {VIEW_LABELS[v]}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-auto pt-5 border-t border-line">
          {status}
        </div>
      </header>

      <main id="main" className="min-w-0">
        <div className="mx-auto w-full max-w-305 px-5 sm:px-8 py-7 sm:py-10">
          <div className="lg:hidden mb-6">{status}</div>
          {children}
          {frames}
        </div>
      </main>
    </div>
  );
}

/**
 * The persistent status block.
 *
 * Answers "is this thing on", and nothing else. The measurements behind it live
 * in the WebMCP view, one click away through the transport badge.
 */
export function ProtectionStatus({
  mediating,
  origins,
  capabilities,
  transport,
  onOpenDiagnostics,
}: {
  mediating: boolean;
  origins: number;
  capabilities: number;
  transport: "Native" | "Fallback" | "Starting";
  onOpenDiagnostics: () => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 m-0">
        <Dot tone={mediating ? "trusted" : "neutral"} hollow={!mediating} />
        <span
          className={`text-[13.5px] font-medium ${mediating ? "text-trusted" : "text-fg-3"}`}
        >
          {mediating ? "Protected" : "Starting"}
        </span>
      </p>

      <dl className="m-0 grid gap-2 text-[12.5px]">
        <div className="flex gap-3 justify-between">
          <dt className="text-fg-4">Origins</dt>
          <dd className="m-0 text-fg-2 tabular-nums">{origins}</dd>
        </div>
        <div className="flex gap-3 justify-between">
          <dt className="text-fg-4">Capabilities</dt>
          <dd className="m-0 text-fg-2 tabular-nums">{capabilities}</dd>
        </div>
        <div className="flex gap-3 justify-between items-center">
          <dt className="text-fg-4">Transport</dt>
          <dd className="m-0">
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="bg-transparent border-0 p-0 cursor-pointer rounded-sm"
              aria-label={`Transport: ${transport}. Open WebMCP diagnostics`}
              title="Open WebMCP diagnostics"
            >
              <Badge tone={transport === "Native" ? "trusted" : "semi"}>
                {transport}
              </Badge>
            </button>
          </dd>
        </div>
      </dl>
    </div>
  );
}
