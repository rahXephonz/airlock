import type { FlowNode, FlowStatus } from '../state/trustflow';
import { Dot, Tag, type Tone } from './primitives';

/**
 * The live trust flow.
 *
 * Five fixed nodes, because the architecture is fixed: two partner origins, the
 * agent that can reach both, the policy engine every call goes through, and the
 * one capability that writes. What changes is their state, and the state comes
 * from the ledger — so the picture is a reading of what happened rather than an
 * illustration of what usually happens.
 *
 * Drawn in CSS rather than SVG: text that has to stay legible at any width is
 * text the browser should be allowed to lay out, and a diagram that clips on a
 * narrow screen would be worse than no diagram.
 */

const TRUST_TONE: Record<string, Tone> = {
  trusted: 'trusted',
  'semi-trusted': 'semi',
  self: 'self',
  agent: 'self',
  engine: 'self',
};

const STATUS_TONE: Record<FlowStatus, Tone> = {
  idle: 'neutral',
  active: 'self',
  done: 'trusted',
  tainted: 'semi',
  blocked: 'bad',
  never: 'bad',
};

const NODE_RING: Record<FlowStatus, string> = {
  idle: 'border-seam',
  active: 'border-self-dim',
  done: 'border-trusted-dim',
  tainted: 'border-semi-dim',
  blocked: 'border-blocked',
  never: 'border-blocked-dim border-dashed',
};

const EDGE_BORDER: Record<FlowStatus, string> = {
  idle: 'border-seam',
  active: 'border-self-dim',
  done: 'border-trusted-dim',
  tainted: 'border-semi-dim',
  blocked: 'border-blocked',
  never: 'border-blocked',
};

const EDGE_TEXT: Record<FlowStatus, string> = {
  idle: 'text-ink-3',
  active: 'text-self',
  done: 'text-ink-3',
  tainted: 'text-semi',
  blocked: 'text-blocked',
  never: 'text-blocked',
};

function Marker({ node }: { node: FlowNode }) {
  if (node.status === 'blocked') {
    return (
      <span className="text-blocked font-mono text-[13px] leading-none" aria-hidden>
        ✕
      </span>
    );
  }
  if (node.status === 'never') return <Dot hollow />;
  return <Dot tone={STATUS_TONE[node.status]} />;
}

export function TrustGraph({ nodes }: { nodes: readonly FlowNode[] }) {
  return (
    <ol className="list-none p-0 m-0">
      {nodes.map((node, i) => {
        const last = i === nodes.length - 1;
        const engine = node.id === 'airlock';

        return (
          <li key={node.id}>
            <div
              className={[
                'grid grid-cols-[minmax(0,17ch)_minmax(0,1fr)] gap-4 items-center',
                'border rounded-[3px] px-3.5 py-2.5 bg-panel transition-colors duration-200',
                engine ? 'bg-panel-2' : '',
                NODE_RING[node.status],
              ].join(' ')}
            >
              <div className="flex gap-2 items-center min-w-0">
                <Marker node={node} />
                <span
                  className={`font-mono text-[13px] truncate ${
                    engine ? 'text-self font-medium' : 'text-ink'
                  }`}
                >
                  {node.title}
                </span>
              </div>

              <div className="flex gap-2.5 items-center justify-between min-w-0 flex-wrap">
                <span
                  className={`text-[13px] ${
                    node.status === 'blocked' || node.status === 'never'
                      ? 'text-blocked'
                      : node.status === 'idle'
                        ? 'text-ink-3'
                        : 'text-ink-2'
                  }`}
                >
                  {node.detail}
                </span>
                <span className="flex gap-2 items-center">
                  {node.toolName && node.status !== 'idle' && (
                    <code className="font-mono text-[11.5px] text-ink-3 truncate max-w-[28ch]">
                      {node.toolName}
                    </code>
                  )}
                  {node.trust !== 'agent' && node.trust !== 'engine' && (
                    <Tag tone={TRUST_TONE[node.trust] ?? 'neutral'}>{node.trust}</Tag>
                  )}
                </span>
              </div>
            </div>

            {!last && (
              <div className="grid grid-cols-[minmax(0,17ch)_minmax(0,1fr)] gap-4">
                <div className="flex justify-start pl-[7px]">
                  <span
                    className={`block w-0 h-5 border-l ${
                      node.edge ? EDGE_BORDER[node.status] : 'border-seam'
                    } ${node.status === 'blocked' ? 'border-dashed' : ''}`}
                  />
                </div>
                {node.edge && (
                  <span className={`self-center font-mono text-[11px] ${EDGE_TEXT[node.status]}`}>
                    {node.edge}
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
