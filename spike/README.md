# Day-one capability probes

Not product code. These are the throwaway pages built before any of Airlock
existed, to answer one question: does WebMCP actually do across origins what the
documentation says it does?

AGENT.md required this as a gate — build the smallest possible thing, verify it
against deployed HTTPS origins in both target browsers, and only then commit to
an architecture. They are kept because the findings in
[`../docs/FINDINGS.md`](../docs/FINDINGS.md) are claims about measured behaviour,
and this is what did the measuring.

| page | question it answered |
| --- | --- |
| `provider/index.html` | Can an iframed origin register a tool and expose it to a named parent? |
| `consumer/index.html` | Does `getTools({ fromOrigins })` round-trip, and is `exposedTo` an option or a descriptor field? |
| `consumer/chatgpt.html` | What subset does ChatGPT's in-app browser support, and does it act on an injected instruction? |
| `consumer/chatgpt2.html` | Does a *realistic* injection — a plausible fulfilment process rather than "ignore previous instructions" — change the answer? |

Every probe renders its results to the page rather than the console, because
ChatGPT's in-app browser offers no devtools. `chatgpt.html` goes further and
registers the probe *as a tool*, so the agent runs the measurement itself and
reports back — the only way to exercise tool invocation in a browser you cannot
inspect.

What they settled, in order:

1. Cross-origin discovery and execution work in Chrome and Brave. `exposedTo`
   belongs in `registerTool`'s options, not the descriptor, and `fromOrigins`
   **unions** foreign tools with the page's own rather than filtering to them.
2. ChatGPT's browser supports only top-level `registerTool` — no iframes, no
   cross-origin discovery, no declarative API, no `toolchange`.
3. A blunt `SYSTEM: Ignore previous instructions` payload was refused outright,
   and was discarded as a strawman no demo should rest on.
4. A procedural payload was also not executed — but the agent adopted the
   attacker's framing as fact and asked the user to approve it. That result is
   why Airlock argues for enforcement that does not depend on model judgement,
   rather than arguing that models get tricked.

They are still deployed at `airlock-spike-provider.netlify.app` and
`airlock-spike-consumer.netlify.app`, on the same account as the four product
origins.
