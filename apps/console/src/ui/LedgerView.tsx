import type { LedgerEntry } from '../state/ledger';

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

/**
 * The audit log. Every mediated call, its disposition, and the reasons behind
 * it, kept as data so a decision can be reviewed after the moment it was made.
 */
export function LedgerView({ entries }: { entries: readonly LedgerEntry[] }) {
  if (entries.length === 0) {
    return <div className="muted">No calls yet. Run the scenario, or call a tool directly.</div>;
  }

  return (
    <div>
      {entries.map((e) => (
        <div key={e.id} className={`entry ${e.outcome}`}>
          <div className="row">
            <span className="muted">{clock(e.at)}</span>
            <code>{e.toolName}</code>
            <span className={`tag ${e.outcome === 'blocked' ? 'bad' : e.outcome === 'allowed' ? 'trusted' : 'semi'}`}>
              {e.outcome}
            </span>
            <span className="muted">{e.origin}</span>
          </div>
          {e.decision.reasons.map((r, i) => (
            <div key={i} className="muted" style={{ marginTop: 4 }}>· {r.detail}</div>
          ))}
          {e.error && <pre>{e.error}</pre>}
          {e.result && <pre>{e.result.slice(0, 600)}</pre>}
        </div>
      ))}
    </div>
  );
}
