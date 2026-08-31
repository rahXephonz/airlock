import type { ProvenanceChain, ProvenanceNode } from '../state/provenance';
import { LABEL } from './primitives';

/**
 * The provenance chain, drawn.
 *
 * The security model is a flow, and a flow read as a paragraph is a flow nobody
 * checks. Four questions have to be answerable at a glance: where the untrusted
 * text entered, what sensitive value it picked up, which boundary the call was
 * about to cross, and where Airlock stopped it. One column of nodes with a rail
 * down the left answers all four without becoming a diagram editor.
 *
 * Everything drawn here comes from `chainFor`, which reads the ledger. There is
 * no display-only state: if the chain shows a link, the policy engine's own
 * substring scan found it.
 */

const DOT: Record<ProvenanceNode['kind'], string> = {
  'untrusted-source': 'bg-semi',
  agent: 'bg-self',
  'sensitive-read': 'bg-trusted',
  target: 'bg-blocked',
};

const RAIL: Record<ProvenanceNode['kind'], string> = {
  'untrusted-source': 'border-semi-dim',
  agent: 'border-self-dim',
  'sensitive-read': 'border-trusted-dim',
  target: 'border-blocked-dim',
};

const TEXT: Record<ProvenanceNode['kind'], string> = {
  'untrusted-source': 'text-semi',
  agent: 'text-self',
  'sensitive-read': 'text-trusted',
  target: 'text-blocked',
};

function Node({ node, last }: { node: ProvenanceNode; last: boolean }) {
  const stopped = node.kind === 'target' && node.stopped;

  return (
    <li className="grid grid-cols-[16px_1fr] gap-3.5">
      {/* The rail and its marker: a dot for a node the value passed through,
          a cross for the one it did not. */}
      <div className="flex flex-col items-center">
        {stopped ? (
          <span
            aria-hidden
            className="w-4 h-4 grid place-items-center text-blocked font-mono text-[13px] leading-none"
          >
            ✕
          </span>
        ) : (
          <span aria-hidden className={`w-2 h-2 mt-[7px] rounded-full ${DOT[node.kind]}`} />
        )}
        {!last && <span className={`flex-1 w-0 border-l border-dashed ${RAIL[node.kind]} my-1`} />}
      </div>

      <div className={last ? 'pb-0' : 'pb-4'}>
        <div className="flex gap-2 items-baseline flex-wrap">
          <span className={`font-mono text-[13.5px] font-medium ${TEXT[node.kind]}`}>
            {node.origin}
          </span>
          {node.trust !== 'agent' && (
            <span className="font-mono text-[11px] text-ink-3">{node.trust}</span>
          )}
          {node.toolName && (
            <code className="font-mono text-[11.5px] text-ink-3 break-all">{node.toolName}</code>
          )}
        </div>

        <p
          className={`text-[13.5px] mt-0.5 ${
            stopped ? 'text-blocked font-medium' : 'text-ink-2'
          }`}
        >
          {node.label}
        </p>

        {node.fragment && (
          <p className="font-mono text-[11.5px] text-ink-3 mt-1.5 break-all">
            carried:{' '}
            <mark className="bg-blocked-dim text-[#ffc9c9] px-[3px] rounded-[2px]">
              {node.fragment.length > 96 ? `${node.fragment.slice(0, 96)}…` : node.fragment}
            </mark>
          </p>
        )}
      </div>
    </li>
  );
}

export function ProvenanceChainView({
  chain,
  title = 'Provenance',
}: {
  chain: ProvenanceChain;
  title?: string;
}) {
  return (
    <div>
      <p className={LABEL}>{title}</p>
      <ol className="list-none p-0 m-0 mt-3">
        {chain.nodes.map((node, i) => (
          <Node
            key={`${node.kind}-${node.origin}-${node.toolName ?? i}`}
            node={node}
            last={i === chain.nodes.length - 1}
          />
        ))}
      </ol>

      {chain.stoppedBeforeCapability && (
        <p className="mt-3.5 font-mono text-[12px] tracking-[0.08em] uppercase text-blocked">
          Capability never reached
        </p>
      )}
    </div>
  );
}
