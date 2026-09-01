# AGENTS.md — Airlock

> Working title. Not locked. Whatever it becomes, the tagline carries the thesis:
> **"Run tools from several origins in one agent session — without trusting them all equally."**

---

## 0. Read this before doing anything

This is a **WebMCP Challenge** submission (Devpost, OpenAI). Hard deadline
**Sept 3 2026, 1:00pm PDT**. Solo build. Roughly four usable build days after
reserving two for the video, README, and submission text.

WebMCP is the in-page `document.modelContext` API — **not** remote MCP servers.
Do not build an MCP server. Do not add `mcp_servers` to anything. If a task
looks like it needs a hosted MCP endpoint, it is off-scope.

Primary references:

- Spec: `github.com/webmachinelearning/webmcp`
- Chrome docs: `developer.chrome.com/docs/ai/webmcp` (imperative + declarative API)
- Security guide: `developer.chrome.com/docs/ai/webmcp/secure-tools`
- OpenAI WebMCP docs: `developers.openai.com/codex/webmcp`

---

## 1. What we are building

A **consent and capability layer for federated agent tools**.

One console page discovers WebMCP tools published by several independent origins,
classifies them by trust, and mediates every call through a visible policy before
it executes. The agent gets to compose capabilities across sites in one session;
the user does not have to blanket-trust all of them.

The federation is not a second feature. It is the reason the consent layer is
non-trivial. Inside a single origin you already trust your own code, so gating it
proves nothing. Keep both halves or the project loses its argument.

### The scenario the whole build serves

Four deployed origins:

| Role       | Purpose                                                                  | Trust                              |
| ---------- | ------------------------------------------------------------------------ | ---------------------------------- |
| `console`  | Airlock itself — discovery, policy, ledger, audit log                    | —                                  |
| `vault`    | Holds something sensitive (notes, records, credentials-ish data)         | trusted, read-heavy                |
| `dispatch` | Performs a real outbound action (send, publish, order)                   | trusted, write-capable             |
| `bazaar`   | Third-party listings whose tool output contains attacker-controlled text | **semi-trusted, injection vector** |

**The attack demo:** `bazaar` returns tool output containing injected instructions
telling the agent to read from `vault` and write the contents through `dispatch`.
That is cross-tool exfiltration — the exact scenario in OpenAI's own MCP threat
table. Airlock detects that data originating from an untrusted-content origin is
flowing into a write-capable tool on a different origin, and refuses to escalate
without explicit, provenance-labelled user consent.

---

## 2. Day 1 is a spike, not a build

**Do not write product code until this passes.**

Build the smallest possible thing: two deployed origins, one tool, one
`getTools({ fromOrigins })` call across an iframe with `allow="tools"`.

Verify it round-trips in **both**:

1. Chrome 149+ with `chrome://flags/#enable-webmcp-testing`
2. ChatGPT's in-app browser

Test against **deployed HTTPS URLs, not localhost** — `fromOrigins` only accepts
secure origins and local behaviour may differ.

Branch on the result:

- **Works in both** → build the full four-origin architecture above.
- **Chrome only** → build the consent layer as the complete product over
  same-origin + iframe tools. Keep the cross-origin path implemented and
  documented, demo it in Chrome, note the limitation honestly in the README.
- **Neither** → drop federation. The consent layer, provenance tracking, and
  injection demo still stand over a single origin with multiple tool namespaces.
  Same thesis, narrower surface.

The consent kernel must be written so this branch is a **configuration change,
not a rewrite**. Tool sources go behind a resolver interface from the first
commit.

---

## 3. WebMCP design rules

The tool surface has to be _designed_, not merely _exposed_. Four well-gated tools
beat ten static CRUD tools, because the whole argument is that policy is
expressible over the surface at all — and a surface nobody shaped has nothing to
express policy over.

**Required:**

- **Tool surface is a function of state.** Register and unregister with
  `AbortSignal` as application state changes. An invalid tool should not exist,
  rather than exist and return an error.
- **Emit and consume `toolchange`** so the agent's view stays coherent.
- **Pass the `signal` argument through to `fetch`** in every `execute`. Cancellation
  must actually cancel.
- **Annotations on every tool.** `readOnlyHint` to separate safe from mutating,
  `untrustedContentHint: true` on anything returning attacker-influenceable text.
- **Use the declarative API** on at least one real form where it fits. The two
  APIs suit different cases; forcing everything through one produces a worse
  surface than using each where it belongs.
- **Structured, instructive errors.** A failed call should teach the agent how to
  fix it, not just fail.
- **Schemas designed for a model.** Enums over free strings, `oneOf` with titles,
  descriptions written for an LLM reader.

**Critical security rule — do not violate:**

> `readOnlyHint` from a foreign origin is an **unverified claim by the tool
> author**, not a guarantee. OpenAI's own docs state write actions can occur even
> when a tool is tagged read-only.

Never let policy decisions rest on a cross-origin annotation. Surface it to the
user as _"this origin claims read-only"_ and decide based on origin trust level
and observed behaviour. Getting this right is worth more than any feature.

**Cheap, and worth doing — parameter overreach detection.** At discovery time you
already have every tool's `inputSchema`. Flag tools requesting fields
disproportionate to their stated purpose (a flight lookup asking for home
address). ~40 lines, and it catches a foreign origin quietly widening what it
collects without changing anything a user would notice.

---

## 4. Scope discipline

**The fixtures are fixtures.** `vault`, `dispatch`, and `bazaar` exist to have
tools, not to be products. A few hundred lines each, minimal UI, ugly on purpose.
Every hour spent styling a fixture is an hour stolen from the console. This is the
single most likely way this project dies.

**Graceful degradation is mandatory.** If a partner origin is unreachable, the
console shows it as unavailable. It does not throw, blank, or hang. See §5 for why
this is not optional.

**Do not require a wallet, login, or any extension** to see the core demo. Anyone
opening the live URL with nothing installed must reach the working product. Any
auth is an optional path, and credentials go in the submission form.

---

## 5. The freeze

After Sept 3 1:00pm PDT, **nothing may be touched** — not the Devpost submission,
not the repo, not the live site — until winners are announced ~Sept 23. Editing
during judging risks eligibility.

That is ~20 days of frozen live infrastructure across four deployments.

- Deploy all four origins on **one provider, one account, one billing state**.
  Do not spread them across Vercel + Netlify + Render just to use three credit
  grants.
- Verify nothing sleeps, expires, or rate-limits on a free tier over three weeks.
- No external API dependency that can rate-limit you into a blank page while
  someone has the live site open.
- Tag the submitted commit. Fork to keep building.

---

## 6. Deliverables

Most people who evaluate this will have the repo and the description and nothing
else; some will open the live URL. The video is required, but the argument cannot
live only there. Budget accordingly.

- [ ] Public repo, **OSS license file detectable in the GitHub About section**
- [ ] Working live URL, no setup required
- [ ] README with an **architecture diagram showing the four origins and the trust
      boundary** — someone reading the code alone must understand the federation
      without watching anything
- [ ] Devpost description covering: why WebMCP fits, how it improves UX, what
      people + agents can now do that was hard before, how WebMCP was implemented
- [ ] Public YouTube demo, **under 3 minutes**, with audio, no copyrighted music
- [ ] Clear testing instructions (which browser, which flag)

### The obvious objection — answer it in paragraph one

The first question anyone asks is: _ChatGPT already requires manual confirmation
before write actions. What does this add?_

The answer: ChatGPT's confirmation is per-call, binary, and **provenance-blind**.
It asks "run this write?" without telling you which origin the tool came from,
what its trust level is, or that the argument values originated in text supplied
by a different, untrusted origin. Airlock adds provenance and policy across a
trust boundary. Lead with this; do not bury it.

### Video arc (one continuous narrative, no feature tour)

Task needs tools from three origins → console discovers them → shows trust
classification → `bazaar` attempts injection through tool output → policy blocks
the escalation and shows why → user confirms the legitimate action → audit log
replays it.

---

## 7. Anti-goals

- Building a remote MCP server
- Polishing the fixture origins
- A demo that requires a wallet, login, or extension to see the core value
- Registering many static tools at mount and calling it leverage
- Trusting `readOnlyHint` from a foreign origin
- Generic naming or vague description text — Devpost explicitly warns against it
- Spreading deployments across providers
- Any feature added after Sept 2

---

## 8. Stack

React + TypeScript, single build tool, one hosting provider for all four origins.
Change this if there's a reason, but change it on day 1, not day 4.

Useful:

- `webmcp-types` (npm) — TypeScript typings for the imperative API
- React hook — listed as `use-webmcp-tool` in Devpost resources and `usewebmcp` in
  Chrome docs. **Check which is current before wiring it in.**
- Chrome DevTools has a WebMCP panel: `developer.chrome.com/docs/devtools/application/webmcp`
- `GoogleChrome/modern-web-guidance` ships a WebMCP skill for coding agents — load it
