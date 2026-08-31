import { ChevronRight, ShieldX } from 'lucide-react';
import type { ProvenanceChain, ProvenanceNode } from '../state/provenance';
import { TEXT_TONE, type Tone } from './primitives';

/**
 * The path a value took to reach one call.
 *
 * A single column with a hairline running through it: the value entered
 * somewhere, picked something up, and stopped. Four questions answered in one
 * glance — where the untrusted text came in, what it collected, which boundary
 * it was about to cross, and where Airlock stopped it.
 *
 * Everything drawn is read from the ledger by `chainFor`. If the chain shows a
 * link, the policy engine's own scan found it.
 */

const TONE: Record<ProvenanceNode['kind'], Tone> = {
  'untrusted-source': 'semi',
  agent: 'system',
  'sensitive-read': 'trusted',
  target: 'blocked',
};

const RAIL: Record<Tone, string> = {
  neutral: 'bg-line-2',
  trusted: 'bg-trusted/30',
  semi: 'bg-semi/30',
  blocked: 'bg-blocked/40',
  system: 'bg-system/30',
};

const MARK: Record<Tone, string> = {
  neutral: 'bg-fg-4',
  trusted: 'bg-trusted',
  semi: 'bg-semi',
  blocked: 'bg-blocked',
  system: 'bg-system',
};

function Node({ node, last }: { node: ProvenanceNode; last: boolean }) {
  const tone = TONE[node.kind];
  const stopped = node.kind === 'target' && node.stopped;

  return (
    <li className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center pt-[5px]">
        {stopped ? (
          <ShieldX className="size-3.5 text-blocked" aria-hidden />
        ) : (
          <span aria-hidden className={`size-[7px] rounded-full ${MARK[tone]}`} />
        )}
        {!last && <span aria-hidden className={`w-px flex-1 my-1.5 ${RAIL[tone]}`} />}
      </div>

      <div className={last ? '' : 'pb-5'}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[13px] font-medium ${stopped ? 'text-blocked' : 'text-fg'}`}>
            {node.origin}
          </span>
          {node.trust !== 'agent' && (
            <span className="text-[11.5px] text-fg-4">{node.trust}</span>
          )}
        </div>
        <p className={`text-[12.5px] mt-0.5 m-0 ${stopped ? 'text-blocked' : 'text-fg-3'}`}>
          {node.label}
        </p>
        {node.toolName && (
          <p className="font-mono text-[11.5px] text-fg-4 mt-1 m-0 break-all">{node.toolName}</p>
        )}
        {node.fragment && (
          <p className="mt-2 m-0 text-[11.5px] font-mono text-fg-3 bg-surface-2 rounded-xs px-2 py-1 break-all">
            {node.fragment.length > 88 ? `${node.fragment.slice(0, 88)}…` : node.fragment}
          </p>
        )}
      </div>
    </li>
  );
}

export function ProvenanceChainView({ chain }: { chain: ProvenanceChain }) {
  return (
    <div>
      <ol className="list-none p-0 m-0">
        {chain.nodes.map((node, i) => (
          <Node
            key={`${node.kind}-${node.origin}-${node.toolName ?? i}`}
            node={node}
            last={i === chain.nodes.length - 1}
          />
        ))}
      </ol>

      {chain.stoppedBeforeCapability && (
        <p className={`mt-4 text-[12.5px] font-medium m-0 ${TEXT_TONE.blocked}`}>
          Capability never reached.
        </p>
      )}
    </div>
  );
}

/** The same path, inline and one line long, for a table or a summary card. */
export function ProvenancePath({ chain }: { chain: ProvenanceChain }) {
  const hops = chain.nodes.filter((n) => n.kind !== 'agent');

  return (
    <p className="flex items-center gap-1.5 flex-wrap text-[12.5px] m-0">
      {hops.map((node, i) => (
        <span key={`${node.origin}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-3 text-fg-4" aria-hidden />}
          <span
            className={
              node.kind === 'target' && node.stopped ? 'text-blocked font-medium' : 'text-fg-2'
            }
          >
            {node.origin}
          </span>
        </span>
      ))}
    </p>
  );
}
