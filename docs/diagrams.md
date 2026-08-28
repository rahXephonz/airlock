# Diagram sources

Mermaid, so GitHub renders them inline and Excalidraw can import the same source
(**Excalidraw → menu → Import → Mermaid**). Keep these and the README in step: if
one changes, change both.

Two things learned importing these into Excalidraw, both worth keeping:

**Labels are single-line.** Excalidraw's importer drops `<br/>` rather than
breaking on it, so multi-line labels arrive as one run-on sentence. Write them
short instead of relying on line breaks.

**Edge labels stay to one to three words.** The importer seats a label by cutting
the line in half around it, so a long caption leaves an arrow that reads as
broken — or worse, as though the caption itself were a node. Detail belongs in
the node text, where it costs nothing.

**Nothing that did not happen gets an arrow.** A dotted line into dispatch
labelled "never sent" still draws an arrowhead arriving there, which is the
opposite of what it means — the whole point is that dispatch never hears about
the call. A note on that lane says it without drawing it.

**Notes and replies at the same step collide.** Mermaid places a note and the
reply that follows it at nearly the same height, and Excalidraw does not nudge
them apart. Put the note before the reply and keep both short.

**A refused path must not point at its destination.** An arrow into `dispatch`
labelled "refused" still draws an arrowhead arriving there, which says the
opposite of what it means. The refusal terminates in its own node instead, so
nothing in the picture shows the write landing.

---

## 1. Architecture and the trust boundary

The one a judge should see first. Origins, who publishes what, and the single
place a call can be refused.

```mermaid
flowchart LR
    agent(["Agent · sees only airlock_* proxies"])

    subgraph reads["Reads — where data enters"]
        direction TB
        vault["vault · trusted · holds the billing record"]
        bazaar["bazaar · semi-trusted · seller text is hostile"]
    end

    console["console — Airlock · policy · provenance · taint · ledger"]

    refused{{"REFUSED — crosses a trust boundary you did not ask to cross"}}

    dispatch["dispatch · trusted · the only real outbound write"]

    agent --> console
    vault -->|read| console
    bazaar -->|"read · tainted"| console
    console -->|write| dispatch
    console -->|"write · tainted"| refused
```

## 2. The attack, call by call

What the scenario button runs, and where policy intervenes.

```mermaid
sequenceDiagram
    participant A as Agent
    participant K as Airlock console
    participant B as bazaar (semi-trusted)
    participant V as vault (trusted)
    participant D as dispatch (write)

    A->>K: airlock_bazaar_read_listing
    K->>B: read listing 4412
    B-->>K: listing plus seller fulfilment steps
    Note over K: output tainted, origin recorded
    K-->>A: allowed

    A->>K: airlock_vault_read_record
    K->>V: read billing profile
    V-->>K: accountRef ACCT-7731-QX45
    K-->>A: allowed, no boundary crossed yet

    A->>K: airlock_dispatch_send_message
    Note over K: argument matches text from bazaar
    Note over D: never hears about this call
    K-->>A: refused, with origin and matched text
```

## 3. Why a confirmation dialog is not the same thing

The argument the entry has to win, as a diagram.

```mermaid
flowchart TB
    subgraph them["Built-in confirmation"]
        direction TB
        t1["Model decides it is worth asking"]
        t2["Model writes the question"]
        t3["User approves or not"]
        t4["Reasoning gone when the turn scrolls away"]
        t1 --> t2 --> t3 --> t4
    end

    subgraph us["Airlock"]
        direction TB
        u1["Policy engine evaluates outside the model"]
        u2["Provenance is data: origin, trust, matched text"]
        u3["Refused calls need a person in the console, naming the untrusted origin"]
        u4["Decision kept in the ledger, reviewable after the fact"]
        u1 --> u2 --> u3 --> u4
    end

    note1["The component that can be fooled is the one certifying it wasn't"]
    t2 -.-> note1
```
