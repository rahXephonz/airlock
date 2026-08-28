/**
 * The trust boundary, drawn.
 *
 * A judge reading the repo has to understand the federation without watching
 * anything, so the diagram shows the actual mechanism rather than decorating the
 * page: which origins publish tools, where their output is treated as hostile,
 * and the one place a refusal can happen. The seam down the middle is the
 * boundary itself — every path crosses it, and the refused path is the only one
 * that stops there.
 *
 * Text is positioned against fixed columns rather than centred on its line: at
 * this size a caption that grows to the right will run under the next box, and
 * SVG will not wrap it. Long captions are split by hand for the same reason.
 */

const MONO = 'IBM Plex Mono, ui-monospace, monospace';
const SANS = 'IBM Plex Sans, ui-sans-serif, system-ui, sans-serif';

export function TrustDiagram() {
  return (
    <svg viewBox="0 0 900 300" role="img"
         aria-label="Vault and bazaar publish tools to the Airlock console, which mediates every call. A write to dispatch carrying text that came from bazaar is refused at the trust boundary.">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#6c7d8c" />
        </marker>
        <marker id="arrow-warn" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#e0a33e" />
        </marker>
      </defs>

      {/* The boundary seam. */}
      <line x1="470" y1="16" x2="470" y2="266" stroke="#26333f" strokeWidth="1"
            strokeDasharray="3 5" />
      <text x="478" y="28" fill="#6c7d8c" fontSize="11" fontFamily={MONO}
            letterSpacing="1.4">TRUST BOUNDARY</text>

      {/* vault — trusted, holds what is worth stealing */}
      <rect x="16" y="46" width="188" height="70" rx="3" fill="#111820" stroke="#1b3830" />
      <text x="32" y="72" fill="#5ec9a7" fontSize="14" fontFamily={MONO}>vault</text>
      <text x="32" y="92" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>trusted · holds the</text>
      <text x="32" y="107" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>billing record</text>

      {/* bazaar — semi-trusted, the injection vector */}
      <rect x="16" y="182" width="188" height="70" rx="3" fill="#111820" stroke="#3a2e12" />
      <text x="32" y="208" fill="#e0a33e" fontSize="14" fontFamily={MONO}>bazaar</text>
      <text x="32" y="228" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>semi-trusted · seller</text>
      <text x="32" y="243" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>text is hostile input</text>

      {/* console — the only path through */}
      <rect x="296" y="104" width="150" height="92" rx="3" fill="#141d26" stroke="#26405c" />
      <text x="314" y="132" fill="#6ea8e8" fontSize="14" fontFamily={MONO}>console</text>
      <text x="314" y="152" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>policy · provenance</text>
      <text x="314" y="167" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>taint · ledger</text>
      <text x="314" y="185" fill="#6c7d8c" fontSize="11" fontFamily={MONO}>airlock_*</text>

      {/* dispatch — trusted, but the only real write */}
      <rect x="690" y="114" width="194" height="72" rx="3" fill="#111820" stroke="#1b3830" />
      <text x="708" y="140" fill="#5ec9a7" fontSize="14" fontFamily={MONO}>dispatch</text>
      <text x="708" y="160" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>trusted · the only</text>
      <text x="708" y="175" fill="#a3b1bf" fontSize="12" fontFamily={SANS}>real outbound write</text>

      {/* reads into the console */}
      <path d="M204 81 C 248 81, 254 128, 292 132" fill="none" stroke="#6c7d8c"
            strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="212" y="72" fill="#6c7d8c" fontSize="11" fontFamily={MONO}>read</text>

      <path d="M204 217 C 248 217, 254 172, 292 168" fill="none" stroke="#e0a33e"
            strokeWidth="1.5" markerEnd="url(#arrow-warn)" />
      <text x="212" y="236" fill="#e0a33e" fontSize="11" fontFamily={MONO}>read · tainted</text>

      {/* the refused write */}
      <path d="M448 150 L 618 150" fill="none" stroke="#e06c6c" strokeWidth="1.5"
            strokeDasharray="5 4" />
      <g transform="translate(638 150)">
        <circle r="15" fill="#1d1214" stroke="#e06c6c" strokeWidth="1.5" />
        <path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke="#e06c6c" strokeWidth="1.8"
              strokeLinecap="round" />
      </g>
      <text x="452" y="138" fill="#e06c6c" fontSize="11.5" fontFamily={MONO}>
        write carrying bazaar text
      </text>
      <text x="452" y="194" fill="#6c7d8c" fontSize="11.5" fontFamily={SANS}>
        refused — crosses a trust boundary
      </text>
      <text x="452" y="210" fill="#6c7d8c" fontSize="11.5" fontFamily={SANS}>
        you did not ask to cross
      </text>

      {/* what the agent is actually handed */}
      <text x="16" y="288" fill="#6c7d8c" fontSize="11.5" fontFamily={SANS}>
        The agent is handed Airlock&apos;s proxies, never the partner tools — so policy is the only path to the capability.
      </text>
    </svg>
  );
}
