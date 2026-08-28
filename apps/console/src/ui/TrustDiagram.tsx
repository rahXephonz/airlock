/**
 * The trust boundary, drawn.
 *
 * A judge reading the repo has to understand the federation without watching
 * anything, so the diagram shows the actual mechanism rather than decorating the
 * page: which origins publish tools, where their output is treated as hostile,
 * and the one place a refusal can happen. The seam down the middle is the
 * boundary itself — every path crosses it, and the refused path is the only one
 * that stops there.
 */
export function TrustDiagram() {
  return (
    <svg viewBox="0 0 900 300" role="img"
         aria-label="Vault and bazaar publish tools to the Airlock console, which mediates every call. Text from bazaar flowing to a write on dispatch is refused at the trust boundary.">
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
      <line x1="450" y1="16" x2="450" y2="284" stroke="#26333f" strokeWidth="1"
            strokeDasharray="3 5" />
      <text x="458" y="28" fill="#6c7d8c" fontSize="11" fontFamily="IBM Plex Mono, monospace"
            letterSpacing="1.4">TRUST BOUNDARY</text>

      {/* vault — trusted, holds what is worth stealing */}
      <rect x="16" y="46" width="188" height="70" rx="3" fill="#111820" stroke="#1b3830" />
      <text x="32" y="72" fill="#5ec9a7" fontSize="14" fontFamily="IBM Plex Mono, monospace">vault</text>
      <text x="32" y="92" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">trusted · holds the</text>
      <text x="32" y="107" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">billing record</text>

      {/* bazaar — semi-trusted, the injection vector */}
      <rect x="16" y="182" width="188" height="70" rx="3" fill="#111820" stroke="#3a2e12" />
      <text x="32" y="208" fill="#e0a33e" fontSize="14" fontFamily="IBM Plex Mono, monospace">bazaar</text>
      <text x="32" y="228" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">semi-trusted · seller</text>
      <text x="32" y="243" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">text is hostile input</text>

      {/* console — the only path through */}
      <rect x="300" y="104" width="152" height="92" rx="3" fill="#141d26" stroke="#26405c" />
      <text x="318" y="132" fill="#6ea8e8" fontSize="14" fontFamily="IBM Plex Mono, monospace">console</text>
      <text x="318" y="152" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">policy · provenance</text>
      <text x="318" y="167" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">taint · ledger</text>
      <text x="318" y="184" fill="#6c7d8c" fontSize="11" fontFamily="IBM Plex Mono, monospace">airlock_*</text>

      {/* dispatch — trusted but write-capable */}
      <rect x="700" y="114" width="184" height="72" rx="3" fill="#111820" stroke="#1b3830" />
      <text x="718" y="140" fill="#5ec9a7" fontSize="14" fontFamily="IBM Plex Mono, monospace">dispatch</text>
      <text x="718" y="160" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">trusted · the only</text>
      <text x="718" y="175" fill="#a3b1bf" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">real outbound write</text>

      {/* reads into the console */}
      <path d="M204 81 C 250 81, 258 128, 296 132" fill="none" stroke="#6c7d8c"
            strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="212" y="72" fill="#6c7d8c" fontSize="11" fontFamily="IBM Plex Mono, monospace">read</text>

      <path d="M204 217 C 250 217, 258 172, 296 168" fill="none" stroke="#e0a33e"
            strokeWidth="1.5" markerEnd="url(#arrow-warn)" />
      <text x="212" y="236" fill="#e0a33e" fontSize="11" fontFamily="IBM Plex Mono, monospace">read · tainted</text>

      {/* the refused write */}
      <path d="M452 150 L 656 150" fill="none" stroke="#e06c6c" strokeWidth="1.5"
            strokeDasharray="5 4" />
      <g transform="translate(672 150)">
        <circle r="15" fill="#1d1214" stroke="#e06c6c" strokeWidth="1.5" />
        <path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke="#e06c6c" strokeWidth="1.8"
              strokeLinecap="round" />
      </g>
      <text x="470" y="140" fill="#e06c6c" fontSize="11.5"
            fontFamily="IBM Plex Mono, monospace">write carrying bazaar text</text>
      <text x="470" y="176" fill="#6c7d8c" fontSize="11.5"
            fontFamily="IBM Plex Sans, sans-serif">refused: crosses a boundary you did not ask to cross</text>

      {/* what the agent is actually given */}
      <text x="16" y="290" fill="#6c7d8c" fontSize="11.5" fontFamily="IBM Plex Sans, sans-serif">
        The agent is given Airlock&apos;s proxies, never the partner tools — so policy is the only path to the capability.
      </text>
    </svg>
  );
}
