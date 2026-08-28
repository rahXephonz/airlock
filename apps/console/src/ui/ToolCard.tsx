import { detectOverreach, type DiscoveredTool } from '@airlock/shared';
import { Button, PANEL, Tag, toneForTrust } from './primitives';

const WRITE_VERB =
  /^(publish|send|post|order|create|update|delete|write|pay|transfer|share|submit|remove|set)/;

/**
 * One discovered tool, with what its origin claims and what Airlock concluded
 * shown side by side.
 *
 * Keeping the two visually distinct is the point: a reader should be able to see
 * that "read-only" is something the origin said, not something anyone verified.
 */
export function ToolCard({ tool, onRun }: {
  tool: DiscoveredTool;
  onRun: (tool: DiscoveredTool) => void;
}) {
  const overreach = detectOverreach(tool);
  const contested =
    tool.claimsReadOnly && WRITE_VERB.test(tool.name.replace(/^[a-z]+_/, ''));

  return (
    <div className={`${PANEL} grid grid-cols-[1fr_auto] gap-3.5 items-start px-4 py-3.5`}>
      <div>
        <span className="font-mono text-sm font-medium">{tool.name}</span>
        <p className="text-ink-2 text-[13.5px] mt-1 max-w-[74ch]">{tool.raw.description}</p>

        <div className="flex gap-1.5 flex-wrap mt-2.5">
          <Tag tone={toneForTrust(tool.profile?.trust)}>
            {tool.profile?.name ?? 'unclassified'} · {tool.profile?.trust ?? 'unknown'}
          </Tag>
          {tool.claimsReadOnly && (
            <Tag tone={contested ? 'bad' : 'neutral'}>
              {contested ? 'claims read-only — contested' : 'claims read-only'}
            </Tag>
          )}
          {tool.claimsUntrustedContent && <Tag tone="semi">emits untrusted content</Tag>}
          {overreach.map((o) => (
            <Tag key={o.field} tone="bad">overreach: {o.field}</Tag>
          ))}
        </div>
      </div>

      <Button onClick={() => onRun(tool)}>Call</Button>
    </div>
  );
}
