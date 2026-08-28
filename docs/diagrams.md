# Diagram sources

Mermaid, so GitHub renders them inline and Excalidraw can import the same source
(**Excalidraw → menu → Import → Mermaid**). Keep these and the README in step: if
one changes, change both.

If Excalidraw renders `<br/>` literally rather than as a line break, shorten the
labels to a single line — the shapes and edges matter more than the captions.

---

## 1. Architecture and the trust boundary

The one a judge should see first. Origins, who publishes what, and the single
place a call can be refused.

```mermaid
flowchart LR
    agent(["Agent session"])

    subgraph sources["Reads — where data enters"]
        direction TB
        vault["vault<br/>trusted<br/>holds the billing record"]
        bazaar["bazaar<br/>semi-trusted<br/>seller text is hostile input"]
    end

    console["console — Airlock<br/>policy · provenance<br/>taint · ledger<br/>publishes airlock_* proxies"]

    subgraph boundary["Trust boundary — writes cross here"]
        dispatch["dispatch<br/>trusted, write-capable<br/>irreversible outbound action"]
    end

    agent -->|"sees only airlock_* proxies,<br/>never the partner tools"| console
    vault -->|"read"| console
    bazaar -->|"read · output is tainted"| console
    console -->|"write with untainted arguments"| dispatch
    console -.->|"write carrying bazaar text<br/>REFUSED"| dispatch
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
    B-->>K: listing + seller "fulfilment steps"
    Note over K: output marked tainted,<br/>origin recorded
    K-->>A: allowed

    A->>K: airlock_vault_read_record
    K->>V: read billing profile
    V-->>K: accountRef ACCT-7731-QX45
    K-->>A: allowed — nothing crossed a boundary yet

    A->>K: airlock_dispatch_send_message<br/>body = "ORDER 4412 ref=ACCT-7731-QX45"
    Note over K: argument matches text that<br/>came out of bazaar
    K--xD: never sent
    K-->>A: refused — names the origin,<br/>the boundary, and the matched text
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
        u3["Refused calls need a person, in the console,<br/>naming the untrusted origin"]
        u4["Decision kept in the ledger, reviewable after the fact"]
        u1 --> u2 --> u3 --> u4
    end

    note1["The component that can be fooled<br/>is the one certifying it wasn't"]
    t2 -.-> note1
```
