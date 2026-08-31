import type { FlowNode, FlowStatus } from '../state/trustflow';

/**
 * The trust flow.
 *
 * Two origins read into the agent; the agent tries to write through Airlock to
 * a third. That shape is the product, so it is drawn as a shape rather than
 * stacked into a list. The boundary is a real line down the middle of the
 * picture, and the refusal happens on it.
 *
 * State comes from the ledger by way of `flowFor` — an idle graph means nothing
 * has run, and the cross on the boundary appears because the policy engine
 * refused, not because an animation finished.
 *
 * One SVG, no library. Text is placed against fixed columns because SVG will
 * not wrap it, and the whole thing scales with the viewport.
 */

const FILL: Record<FlowStatus, string> = {
  idle: 'fill-fg-4',
  active: 'fill-system',
  done: 'fill-trusted',
  tainted: 'fill-semi',
  blocked: 'fill-blocked',
  never: 'fill-none',
};

const NAME: Record<FlowStatus, string> = {
  idle: 'fill-fg-3',
  active: 'fill-fg',
  done: 'fill-fg',
  tainted: 'fill-fg',
  blocked: 'fill-fg',
  never: 'fill-fg-3',
};

const DETAIL: Record<FlowStatus, string> = {
  idle: 'fill-fg-4',
  active: 'fill-system',
  done: 'fill-fg-3',
  tainted: 'fill-semi',
  blocked: 'fill-blocked',
  never: 'fill-blocked',
};

const EDGE: Record<FlowStatus, string> = {
  idle: 'stroke-line-2',
  active: 'stroke-system',
  done: 'stroke-trusted/45',
  tainted: 'stroke-semi/60',
  blocked: 'stroke-blocked/60',
  never: 'stroke-line-2',
};

/** One node: a marker, a name, and a line of what happened to it. */
function Node({
  node,
  x,
  y,
}: {
  node: FlowNode;
  x: number;
  y: number;
}) {
  const hollow = node.status === 'never' || node.status === 'idle';

  return (
    <g className={node.status === 'active' ? 'animate-pulse-soft' : undefined}>
      {hollow ? (
        <circle cx={x} cy={y} r="3.5" className="fill-none stroke-line-3" strokeWidth="1" />
      ) : (
        <circle cx={x} cy={y} r="3.5" className={FILL[node.status]} />
      )}
      <text x={x + 13} y={y + 5} className={`${NAME[node.status]} text-[14.5px] font-medium`}>
        {node.title}
      </text>
      <text x={x + 13} y={y + 23} className={`${DETAIL[node.status]} text-[12.5px]`}>
        {node.detail}
      </text>
      {node.trust !== 'agent' && node.trust !== 'engine' && (
        <text x={x + 13} y={y - 13} className="fill-fg-4 text-[11.5px]">
          {node.trust}
        </text>
      )}
    </g>
  );
}

export function TrustGraph({ nodes }: { nodes: readonly FlowNode[] }) {
  const [bazaar, agent, vault, airlock, dispatch] = nodes as readonly [
    FlowNode,
    FlowNode,
    FlowNode,
    FlowNode,
    FlowNode,
  ];

  const refused = airlock.status === 'blocked';
  const boundaryTone = refused
    ? 'stroke-blocked/50'
    : airlock.status === 'active'
      ? 'stroke-system/50'
      : 'stroke-line-2';

  return (
    <svg
      viewBox="0 0 856 248"
      className="w-full h-auto"
      focusable="false"
      role="img"
      aria-label={`Trust flow. Bazaar: ${bazaar.detail}. Agent: ${agent.detail}. Vault: ${vault.detail}. Airlock: ${airlock.detail}. Dispatch: ${dispatch.detail}.`}
    >
      {/* The boundary itself. Everything crosses it; one thing does not. */}
      <line
        x1="600"
        y1="18"
        x2="600"
        y2="232"
        className={boundaryTone}
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      <text x="600" y="242" textAnchor="middle" className="fill-fg-4 text-[11.5px]">
        trust boundary
      </text>

      {/* bazaar and vault read into the agent */}
      <path
        d="M 176 62 C 250 62, 250 118, 322 118"
        fill="none"
        strokeWidth="1.25"
        className={EDGE[bazaar.status]}
      />
      <path
        d="M 176 190 C 250 190, 250 134, 322 134"
        fill="none"
        strokeWidth="1.25"
        className={EDGE[vault.status]}
      />

      {/* the agent's write, heading for dispatch through the engine */}
      <path
        d="M 470 126 L 566 126"
        fill="none"
        strokeWidth="1.25"
        className={EDGE[airlock.status]}
      />
      <path
        d="M 634 126 L 700 126"
        fill="none"
        strokeWidth="1.25"
        strokeDasharray={refused ? '3 5' : undefined}
        className={refused ? 'stroke-line-2' : EDGE[dispatch.status]}
      />

      {bazaar.edge && (
        <text x="198" y="90" className="fill-semi text-[11.5px]">
          {bazaar.edge}
        </text>
      )}
      {vault.edge && (
        <text x="198" y="166" className="fill-fg-3 text-[11.5px]">
          {vault.edge}
        </text>
      )}

      <Node node={bazaar} x={24} y={62} />
      <Node node={vault} x={24} y={190} />
      <Node node={agent} x={330} y={126} />

      {/* Airlock sits on the boundary. Its mark is the only thing on the line. */}
      <g>
        <rect
          x="576"
          y="102"
          width="48"
          height="48"
          rx="10"
          className={
            refused
              ? 'fill-blocked-tint stroke-blocked/40'
              : airlock.status === 'active'
                ? 'fill-system-tint stroke-system/40'
                : 'fill-surface-2 stroke-line-2'
          }
          strokeWidth="1"
        />
        {refused ? (
          <path
            d="M591 117 l18 18 M609 117 l-18 18"
            className="stroke-blocked"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M600 112 l14 7 v9 c0 8 -6 14 -14 17 c-8 -3 -14 -9 -14 -17 v-9 z"
            className={
              airlock.status === 'active'
                ? 'fill-none stroke-system'
                : 'fill-none stroke-fg-3'
            }
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        <text x="600" y="173" textAnchor="middle" className="fill-fg-2 text-[13px] font-medium">
          Airlock
        </text>
        <text
          x="600"
          y="190"
          textAnchor="middle"
          className={`text-[12px] ${refused ? 'fill-blocked' : 'fill-fg-4'}`}
        >
          {airlock.detail}
        </text>
      </g>

      <Node node={dispatch} x={706} y={126} />
    </svg>
  );
}
