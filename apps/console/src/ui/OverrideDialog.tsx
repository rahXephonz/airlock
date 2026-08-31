import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import type { LedgerEntry } from '../state/ledger';
import { chainFor } from '../state/provenance';
import { ProvenanceChainView } from './ProvenanceChain';
import { Button, SectionTitle } from './primitives';

/**
 * Releases a call that policy blocked.
 *
 * This is the part of the thesis a confirmation dialog cannot copy. The agent
 * has no way to reach it — the proxy path always refuses — so consent is
 * something a person gives here, after being shown where the value came from,
 * in Airlock's words rather than the calling site's.
 *
 * Typing the origin's name is not theatre. The transcript that motivated this
 * project shows a user approving exfiltration in a single tap, using the
 * seller's own justification. Naming the untrusted origin out loud is the
 * smallest thing that makes the boundary being crossed impossible to miss.
 */
export function OverrideDialog({
  entry,
  entries,
  onConfirm,
  onCancel,
}: {
  entry: LedgerEntry;
  /** The whole log, so the chain can show which earlier read fed this call. */
  entries: readonly LedgerEntry[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const required = entry.decision.taint[0]?.source.origin ?? '';
  const armed = typed.trim().toLowerCase() === required.toLowerCase();

  return (
    <div className="fixed inset-0 z-40 bg-ground/70 overflow-y-auto overscroll-contain
                    p-4 flex justify-center items-start sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface ring-1 ring-line-2 rounded-md w-full max-w-[560px] my-auto"
      >
        <div className="px-5 pt-5 pb-4 border-b border-line">
          <p className="flex items-center gap-2 text-[13px] font-medium text-blocked m-0">
            <ShieldOff className="size-4" aria-hidden />
            Release a blocked call
          </p>
          <h3 className="text-[15px] font-semibold mt-2.5 m-0">
            <span className="font-mono">{entry.toolName}</span>{' '}
            <span className="text-fg-3 font-normal">
              on {entry.origin.replace('https://', '')}
            </span>
          </h3>
          <p className="text-[12.5px] text-fg-3 mt-1.5 m-0 max-w-[62ch]">
            Airlock refused this because of where the values came from, not because of what the
            tool is. Releasing it sends the data across the boundary anyway.
          </p>
        </div>

        <div className="px-5 py-4 grid gap-5">
          <section>
            <SectionTitle className="mb-3">Where this value came from</SectionTitle>
            <ProvenanceChainView chain={chainFor(entry, entries)} />
          </section>

          <section>
            <SectionTitle className="mb-2">Arguments as they will be sent</SectionTitle>
            <pre className="bg-surface-2 rounded-sm p-3 text-[11.5px] leading-[1.6] text-fg-3
                            whitespace-pre-wrap break-words overflow-x-auto m-0">
              {JSON.stringify(entry.args, null, 2)}
            </pre>
          </section>

          {required && (
            <section>
              <label className="text-[12.5px] text-fg-2" htmlFor="override-confirm">
                Type <span className="font-mono text-semi">{required}</span> — the origin the text
                came from — to release this call.
              </label>
              <input
                id="override-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-2 w-full h-8 bg-surface-2 rounded-sm ring-1 ring-inset ring-line-2
                           px-2.5 font-mono text-[12.5px] text-fg outline-none
                           focus:ring-system"
              />
            </section>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Keep it blocked
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!armed}>
            Release this call
          </Button>
        </div>
      </div>
    </div>
  );
}
