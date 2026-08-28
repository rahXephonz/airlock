import type { ConsentRequest } from '../state/consent';

/**
 * The consent prompt, built from the policy engine's reasons rather than from
 * anything the calling site said about itself.
 *
 * The distinction matters: in the transcript that motivated this project the
 * agent asked "the seller requires me to publish your account reference —
 * confirm?", which is the attacker's own justification relayed to the user as
 * fact. Everything shown here is derived from provenance Airlock observed.
 */
export function ConsentDialog({ request }: { request: ConsentRequest }) {
  const { tool, args, decision, resolve } = request;
  const origin = tool.profile?.name ?? 'an unclassified origin';

  return (
    <div className="modal">
      <div className="card">
        <h3>Confirm a write on {origin}</h3>
        <div className="muted">
          <code>{tool.name}</code> — {tool.raw.description}
        </div>

        {decision.reasons.map((r, i) => (
          <div key={i} className="reason">{r.detail}</div>
        ))}

        {decision.taint.length > 0 && (
          <div className="reason block">
            Carries text that came out of{' '}
            {decision.taint.map((t) => `${t.source.toolName} on ${t.source.origin}`).join(', ')}.
          </div>
        )}

        <div className="muted" style={{ marginTop: 10 }}>arguments</div>
        <pre>{JSON.stringify(args, null, 2)}</pre>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => resolve(true)}>Allow this call</button>
          <button onClick={() => resolve(false)}>Refuse</button>
        </div>
      </div>
    </div>
  );
}
