import type { ConsentRequest } from '../state/consent';
import { Button, LABEL } from './primitives';

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
    <div className="fixed inset-0 z-20 grid place-items-center p-5 bg-[#040709e0]">
      <div className="bg-panel border border-seam-2 rounded-[3px] p-5 w-full max-w-[640px]">
        <p className={LABEL}>Confirm a write</p>
        <h3 className="text-[18px] font-semibold mt-1.5 mb-1">
          {tool.name} on {origin}
        </h3>
        <p className="text-ink-2 text-sm">{tool.raw.description}</p>

        <div className="mt-4">
          {decision.reasons.map((r, i) => (
            <p key={i} className="my-2.5 pl-3 border-l-2 border-semi text-sm leading-[1.55]">
              {r.detail}
            </p>
          ))}
          {decision.taint.length > 0 && (
            <p className="my-2.5 pl-3 border-l-2 border-blocked text-sm leading-[1.55]">
              Carries text that came out of{' '}
              {decision.taint.map((t) => `${t.source.toolName} on ${t.source.origin}`).join(', ')}.
            </p>
          )}
        </div>

        <p className={`${LABEL} mt-4`}>Arguments</p>
        <pre className="bg-[#0b1218] border border-seam rounded-[2px] p-3 mt-2 text-xs
                        leading-[1.55] text-ink-2 whitespace-pre-wrap break-words overflow-x-auto">
          {JSON.stringify(args, null, 2)}
        </pre>

        <div className="flex gap-2.5 mt-5">
          <Button tone="primary" onClick={() => resolve(true)}>Allow this call</Button>
          <Button onClick={() => resolve(false)}>Refuse</Button>
        </div>
      </div>
    </div>
  );
}
