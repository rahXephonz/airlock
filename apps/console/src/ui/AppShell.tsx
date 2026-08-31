import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Blocks,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';
import { VIEWS, VIEW_LABELS, type View } from '../state/route';
import { Badge, Dot } from './primitives';

const ICONS: Record<View, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  activity: Activity,
  policies: ShieldCheck,
  origins: Network,
  webmcp: Blocks,
};

const COLLAPSE_KEY = 'airlock.rail.collapsed';

/**
 * Whether the rail was left collapsed.
 *
 * A viewer's own preference about their own window, so it lives in
 * `localStorage` rather than in the session store the ledger uses — and every
 * access is guarded, because storage throws outright in some embedded webviews
 * rather than returning nothing.
 */
const restoreCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * The Airlock mark.
 *
 * The supplied artwork rather than a drawn glyph: white line work on
 * transparency, so it sits on the rail without a plate behind it.
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
 *
 * The rail collapses to an icon strip. Width is what animates — the labels are
 * removed rather than faded, because text that is mid-fade at 40% opacity is
 * unreadable and reads as a rendering fault. 180ms is long enough to see the
 * panel move and short enough not to be waited on.
 */
export function AppShell({
  view,
  onNavigate,
  status,
  statusCompact,
  children,
  frames,
}: {
  view: View;
  onNavigate: (next: View) => void;
  status: ReactNode;
  /** The same state, for the icon strip. Same source, less of it. */
  statusCompact: ReactNode;
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
  const [collapsed, setCollapsed] = useState(restoreCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // A full or unavailable store costs the preference, not the session.
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:m-3 focus:px-3
                   focus:py-2 focus:bg-surface-2 focus:rounded-sm focus:text-[13px]"
      >
        Skip to content
      </a>

      <header
        className={[
          'lg:h-screen lg:sticky lg:top-0 shrink-0 border-b lg:border-b-0 lg:border-r',
          'border-line flex lg:flex-col gap-2 lg:gap-0 items-center lg:items-stretch',
          'py-3 lg:py-5 transition-[width,padding] duration-[180ms] ease-out',
          collapsed ? 'px-3 lg:w-[72px] lg:px-3' : 'px-3 lg:w-[268px] lg:px-4',
        ].join(' ')}
      >
        <div
          className={`flex items-center gap-2.5 lg:mb-6 shrink-0 ${
            collapsed ? 'lg:flex-col lg:gap-3' : 'lg:justify-between'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Mark />
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold">Airlock</span>
                <span className="hidden lg:block text-[12px] text-fg-2 mt-1">
                  WebMCP security
                </span>
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:grid place-items-center size-7 rounded-md shrink-0 cursor-pointer
                       text-fg-3 hover:text-fg hover:bg-surface-2 transition-colors duration-150"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </button>
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
                aria-current={active ? 'page' : undefined}
                title={collapsed ? VIEW_LABELS[v] : undefined}
                className={[
                  'flex items-center gap-3 text-[14px] rounded-md h-9 cursor-pointer',
                  'transition-colors duration-150 whitespace-nowrap',
                  collapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3',
                  active
                    ? 'bg-surface-2 text-fg font-medium'
                    : 'text-fg-3 hover:text-fg hover:bg-surface/70',
                ].join(' ')}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className={collapsed ? 'lg:hidden' : ''}>{VIEW_LABELS[v]}</span>
              </button>
            );
          })}
        </nav>

        <div
          className={`hidden lg:block mt-auto pt-5 border-t border-line ${
            collapsed ? 'w-full' : ''
          }`}
        >
          {collapsed ? statusCompact : status}
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1220px] px-5 sm:px-8 py-7 sm:py-10">
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
 *
 * `compact` is what survives when the rail is an icon strip: the same state,
 * read from the same props, reduced to a dot and the transport. It keeps its
 * words in a tooltip and in screen-reader text, because a coloured dot on its
 * own is not a status anyone can read.
 */
export function ProtectionStatus({
  mediating,
  origins,
  capabilities,
  transport,
  compact = false,
  onOpenDiagnostics,
}: {
  mediating: boolean;
  origins: number;
  capabilities: number;
  transport: 'Native' | 'Fallback' | 'Starting';
  compact?: boolean;
  onOpenDiagnostics: () => void;
}) {
  const word = mediating ? 'Protected' : 'Starting';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpenDiagnostics}
        title={`${word} · ${origins} origins · ${capabilities} capabilities · transport: ${transport}`}
        aria-label={`${word}. ${origins} origins, ${capabilities} mediated capabilities, transport ${transport}. Open WebMCP diagnostics`}
        className="flex flex-col items-center gap-2 w-full py-1 rounded-md cursor-pointer
                   bg-transparent border-0 hover:bg-surface-2 transition-colors duration-150"
      >
        <Dot tone={mediating ? 'trusted' : 'neutral'} hollow={!mediating} />
        <span className="font-mono text-[10px] text-fg-4 tabular-nums">{capabilities}</span>
      </button>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 m-0">
        <Dot tone={mediating ? 'trusted' : 'neutral'} hollow={!mediating} />
        <span className={`text-[13.5px] font-medium ${mediating ? 'text-trusted' : 'text-fg-3'}`}>
          {word}
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
              <Badge tone={transport === 'Native' ? 'trusted' : 'semi'}>{transport}</Badge>
            </button>
          </dd>
        </div>
      </dl>
    </div>
  );
}
