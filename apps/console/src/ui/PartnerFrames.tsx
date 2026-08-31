import { TRUST } from '@airlock/shared';
import { LABEL } from './primitives';

const DEAD_ORIGIN = 'https://airlock-this-origin-does-not-exist.netlify.app';

/**
 * The three partner origins, running in their own frames.
 *
 * They are mounted once for the life of the session and never unmounted: each
 * frame publishes its tools with its own `registerTool` calls on load, and a
 * frame that remounted when someone changed view would withdraw and republish
 * the entire federated surface — the console would appear to lose its partners
 * every time a judge clicked a nav item.
 *
 * So navigation moves them off-screen rather than removing them. They keep
 * running, keep their state, and keep publishing. `visibility: hidden` rather
 * than `display: none`, so nothing inside a frame nobody can see is still in the
 * tab order.
 */
export function PartnerFrames({
  partners,
  visible,
  offline,
  onLoad,
  onError,
}: {
  partners: readonly ('vault' | 'dispatch' | 'bazaar')[];
  visible: boolean;
  offline: ReadonlySet<string>;
  onLoad: (name: string) => void;
  onError: (name: string) => void;
}) {
  return (
    <div
      aria-hidden={!visible}
      className={
        visible
          ? 'mt-8'
          : 'invisible absolute -left-[10000px] top-0 w-[960px] pointer-events-none'
      }
    >
      {visible && (
        <p className={`${LABEL} mb-3`}>Partner origins, live — change their state here</p>
      )}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
        {partners.map((name) => (
          <figure key={name} className="m-0">
            <figcaption className="font-mono text-[11px] text-ink-3 mb-1.5 break-all">
              {name} ·{' '}
              {offline.has(name)
                ? 'offline (demonstrating degradation)'
                : TRUST[name].url.replace('https://', '')}
            </figcaption>
            <iframe
              className="w-full h-64 border border-seam rounded-[3px] bg-panel"
              src={offline.has(name) ? DEAD_ORIGIN : TRUST[name].url}
              allow="tools"
              title={name}
              loading="eager"
              onLoad={() => onLoad(name)}
              onError={() => onError(name)}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
