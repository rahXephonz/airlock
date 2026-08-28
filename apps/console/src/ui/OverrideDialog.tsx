import { useState } from 'react';
import type { LedgerEntry } from '../state/ledger';
import { Button, LABEL } from './primitives';

/**
 * Releases a call that policy blocked.
 *
 * This is the part of the thesis that a confirmation dialog cannot copy. The
 * agent has no way to reach it — the proxy path always refuses — so consent is
 * something a person gives from the console, after being shown where the value
 * came from, in Airlock's words rather than the calling site's.
 *
 * Typing the origin's name is not theatre. The transcript that motivated this
 * project shows a user being asked to approve exfiltration in a single tap,
 * using the seller's own justification. Naming the untrusted origin out loud is
 * the smallest thing that makes the boundary being crossed impossible to miss.
 */
export function OverrideDialog({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: LedgerEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const sources = entry.decision.taint;
  const required = sources[0]?.source.origin ?? '';
  const armed = typed.trim().toLowerCase() === required.toLowerCase();

  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-5 bg-[#040709e8]">
      <div className="bg-panel border border-blocked-dim rounded-[3px] p-5 w-full max-w-[640px]">
        <p className={LABEL}>Release a blocked call</p>
        <h3 className="text-[18px] font-semibold mt-1.5 mb-1">
          {entry.toolName} on {entry.origin.replace('https://', '')}
        </h3>

        <p className="text-ink-2 text-sm mt-3">
          Airlock refused this because of where the values came from, not because of
          what the tool is. Releasing it sends the data across the boundary anyway.
        </p>

        {sources.length > 0 && (
          <div className="mt-4">
            <p className={LABEL}>Where this value came from</p>
            <ol className="mt-2 list-none p-0 m-0 grid gap-2">
              {sources.map((t, i) => (
                <li key={i} className="border-l-2 border-blocked pl-3 text-sm leading-[1.55]">
                  <code className="font-mono text-xs text-ink-3">{t.source.toolName}</code>{' '}
                  on <span className="text-semi">{t.source.origin}</span> returned text that
                  appears in this call:
                  <mark className="ml-1 bg-blocked-dim text-[#ffc9c9] px-[3px] rounded-[2px] font-mono text-xs">
                    {t.fragment}
                  </mark>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className={`${LABEL} mt-4`}>Arguments as they will be sent</p>
        <pre className="bg-[#0b1218] border border-seam rounded-[2px] p-3 mt-2 text-xs
                        leading-[1.55] text-ink-2 whitespace-pre-wrap break-words overflow-x-auto">
          {JSON.stringify(entry.args, null, 2)}
        </pre>

        {required && (
          <div className="mt-4">
            <label className="text-sm text-ink-2" htmlFor="override-confirm">
              Type <span className="font-mono text-semi">{required}</span> — the origin the
              text came from — to release this call.
            </label>
            <input
              id="override-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full bg-[#0b1218] border border-seam-2 rounded-[2px] px-3 py-2
                         font-mono text-sm text-ink outline-none focus:border-self"
            />
          </div>
        )}

        <div className="flex gap-2.5 mt-5">
          <Button tone="danger" onClick={onConfirm} disabled={!armed}>
            Release this call
          </Button>
          <Button onClick={onCancel}>Keep it blocked</Button>
        </div>
      </div>
    </div>
  );
}
