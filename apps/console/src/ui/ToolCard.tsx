import { detectOverreach, type DiscoveredTool } from '@airlock/shared';

const trustClass = (t: string | undefined) =>
  t === 'self' ? 'self' : t === 'trusted' ? 'trusted' : t === 'semi-trusted' ? 'semi' : 'bad';

/**
 * One discovered tool, with the claims its origin made and Airlock's own view
 * shown side by side.
 *
 * Keeping the two visually separate is the point: a user should be able to see
 * that "read-only" is something the origin said, not something anyone checked.
 */
export function ToolCard({ tool, onRun }: {
  tool: DiscoveredTool;
  onRun: (tool: DiscoveredTool) => void;
}) {
  const overreach = detectOverreach(tool);
  const contested = tool.claimsReadOnly && /^(publish|send|post|order|create|update|delete|write|pay|transfer|share|submit|remove|set)/.test(tool.name.replace(/^[a-z]+_/, ''));

  return (
    <div className="tool">
      <div>
        <code>{tool.name}</code>
        <div className="muted" style={{ marginTop: 3 }}>{tool.raw.description}</div>
        <div className="flags">
          <span className={`tag ${trustClass(tool.profile?.trust)}`}>
            {tool.profile?.name ?? 'unclassified'} · {tool.profile?.trust ?? 'unknown'}
          </span>
          {tool.claimsReadOnly && (
            <span className={`tag ${contested ? 'bad' : ''}`}>
              {contested ? 'claims read-only — contested' : 'claims read-only'}
            </span>
          )}
          {tool.claimsUntrustedContent && <span className="tag semi">emits untrusted content</span>}
          {overreach.map((o) => (
            <span key={o.field} className="tag bad">overreach: {o.field}</span>
          ))}
        </div>
      </div>
      <button onClick={() => onRun(tool)}>call</button>
    </div>
  );
}
