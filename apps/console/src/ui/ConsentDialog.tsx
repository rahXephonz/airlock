import { AlertTriangle } from 'lucide-react';
import type { ConsentRequest } from '../state/consent';
import { Button, SectionTitle } from './primitives';

/**
 * The consent prompt, built from the policy engine's reasons rather than from
 * anything the calling site said about itself.
 *
 * The distinction is the project: in the transcript that motivated this, the
 * agent asked "the seller requires me to publish your account reference —
 * confirm?", which is the attacker's own justification relayed as fact.
 */
export function ConsentDialog({ request }: { request: ConsentRequest }) {
  const { tool, args, decision, resolve } = request;
  const origin = tool.profile?.name ?? 'an unclassified origin';

  return (
    <div className="fixed inset-0 z-40 bg-ground/70 overflow-y-auto overscroll-contain
                    p-4 flex justify-center items-start sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface ring-1 ring-line-2 rounded-md w-full max-w-[560px] my-auto"
      >
        <div className="px-5 pt-5 pb-4 border-b border-line">
          <p className="flex items-center gap-2 text-[13px] font-medium text-semi m-0">
            <AlertTriangle className="size-4" aria-hidden />
            Confirm a write
          </p>
          <h3 className="text-[15px] font-semibold mt-2.5 m-0">
            <span className="font-mono">{tool.name}</span>{' '}
            <span className="text-fg-3 font-normal">on {origin}</span>
          </h3>
          <p className="text-[12.5px] text-fg-3 mt-1.5 m-0">{tool.raw.description}</p>
        </div>

        <div className="px-5 py-4 grid gap-4">
          <div className="grid gap-2.5">
            {decision.reasons.map((r, i) => (
              <p key={i} className="text-[13px] leading-[1.6] text-fg-2 m-0">
                {r.detail}
              </p>
            ))}
            {decision.taint.length > 0 && (
              <p className="text-[13px] leading-[1.6] text-semi m-0">
                Carries text that came out of{' '}
                {decision.taint
                  .map((t) => `${t.source.toolName} on ${t.source.origin}`)
                  .join(', ')}
                .
              </p>
            )}
          </div>

          <div>
            <SectionTitle className="mb-2">Arguments</SectionTitle>
            <pre className="bg-surface-2 rounded-sm p-3 text-[11.5px] leading-[1.6] text-fg-3
                            whitespace-pre-wrap break-words overflow-x-auto m-0">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => resolve(false)}>
            Refuse
          </Button>
          <Button variant="primary" onClick={() => resolve(true)}>
            Allow this call
          </Button>
        </div>
      </div>
    </div>
  );
}
