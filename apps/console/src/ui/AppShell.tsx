import type { ReactNode } from 'react';
import { VIEWS, VIEW_LABELS, type View } from '../state/route';
import { Dot, LABEL } from './primitives';

/**
 * The control-plane shell.
 *
 * Five views, one rail, no nesting. The rail carries the only thing that has to
 * be true on every screen — whether Airlock is mediating, how many origins it
 * covers, and which transport it got — because that is the context every other
 * number on the page depends on.
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[212px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:m-2 focus:px-3
                   focus:py-2 focus:bg-panel focus:border focus:border-seam-2 focus:rounded-[2px]
                   focus:text-[13px]"
      >
        Skip to content
      </a>

      <header className="lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-seam bg-panel flex lg:flex-col">
        <div className="px-4 py-3.5 lg:py-4 flex lg:block gap-4 items-center border-seam lg:border-b">
          <span className="font-mono text-[13px] font-semibold tracking-[0.16em] uppercase">
            Airlock
          </span>
          <p className="hidden lg:block text-ink-3 text-[12px] mt-1.5 leading-snug">
            Capability firewall
            <br />
            for the agentic web
          </p>
        </div>

        <nav aria-label="Views" className="flex lg:flex-col gap-0.5 px-2 py-2 lg:py-3 overflow-x-auto">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onNavigate(v)}
              aria-current={v === view ? 'page' : undefined}
              className={[
                'text-left text-[13px] px-2.5 py-[7px] rounded-[2px] cursor-pointer border',
                'transition-colors whitespace-nowrap',
                v === view
                  ? 'bg-panel-2 border-seam-2 text-ink'
                  : 'bg-transparent border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>

        <div className="hidden lg:block mt-auto px-4 py-4 border-t border-seam">{status}</div>
      </header>

      <main id="main" className="min-w-0 px-4 sm:px-7 py-6 sm:py-8 max-w-[1180px]">
        <div className="lg:hidden mb-5">{status}</div>
        {children}
        {frames}
      </main>
    </div>
  );
}

/**
 * The persistent status block.
 *
 * Deliberately small. It answers "is this thing on" and nothing else; the
 * measurements behind it live in the WebMCP view.
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
  transport: 'Native' | 'Fallback' | 'Starting';
  onOpenDiagnostics: () => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="flex gap-2 items-center m-0">
        <Dot tone={mediating ? 'trusted' : 'neutral'} hollow={!mediating} />
        <span
          className={`font-mono text-[12px] tracking-[0.12em] uppercase ${
            mediating ? 'text-trusted' : 'text-ink-3'
          }`}
        >
          {mediating ? 'Protected' : 'Starting'}
        </span>
      </p>

      <dl className="m-0 grid gap-0.5 text-[12px]">
        <div className="flex gap-2 justify-between">
          <dt className="text-ink-3">Origins</dt>
          <dd className="m-0 font-mono tabular-nums">{origins}</dd>
        </div>
        <div className="flex gap-2 justify-between">
          <dt className="text-ink-3">Mediated capabilities</dt>
          <dd className="m-0 font-mono tabular-nums">{capabilities}</dd>
        </div>
        <div className="flex gap-2 justify-between">
          <dt className="text-ink-3">Transport</dt>
          <dd className="m-0 font-mono">
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className={`bg-transparent border-0 p-0 cursor-pointer underline underline-offset-2 ${
                transport === 'Native' ? 'text-trusted' : 'text-semi'
              }`}
            >
              {transport}
            </button>
          </dd>
        </div>
      </dl>

      <p className={`${LABEL} text-[10px] tracking-[0.14em] mt-1`}>
        Policy · provenance · ledger
      </p>
    </div>
  );
}
