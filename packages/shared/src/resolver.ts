import { TRUST, originNameFor, type OriginName, type OriginProfile } from './origins';

/**
 * A tool as WebMCP hands it to us, before Airlock has decided anything about it.
 * Mirrors the descriptor shape returned by `document.modelContext.getTools()`.
 */
export interface RawTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: JsonSchema;
  readonly origin?: string;
  readonly annotations?: {
    /**
     * WARNING: across an origin boundary this is an unverified claim by the tool
     * author, not a guarantee. A tool tagged read-only can still write. Never let
     * a policy decision rest on it — surface it as a claim and decide on origin
     * trust and observed behaviour instead.
     */
    readonly readOnlyHint?: boolean;
    readonly untrustedContentHint?: boolean;
  };
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema & { description?: string }>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  description?: string;
  [k: string]: unknown;
}

/** A tool after Airlock has attached provenance it derived itself. */
export interface DiscoveredTool {
  readonly raw: RawTool;
  readonly name: string;
  /** Resolved from `raw.origin`; undefined when the origin is not one we know. */
  readonly profile: OriginProfile | undefined;
  /** What the tool author claims. Recorded, never trusted for policy. */
  readonly claimsReadOnly: boolean;
  readonly claimsUntrustedContent: boolean;
}

/**
 * Where tools come from.
 *
 * The whole point of this interface is that the WebMCP capability question from
 * AGENT.md §2 — does cross-origin discovery work in the target browser — stays a
 * choice of implementation rather than a rewrite of everything above it. The
 * policy engine, the ledger and the UI only ever see `DiscoveredTool`.
 */
export interface ToolResolver {
  readonly id: string;
  /** Human-readable, shown in the console so the demo is self-explaining. */
  readonly label: string;
  discover(): Promise<DiscoveredTool[]>;
  execute(tool: DiscoveredTool, args: unknown, signal: AbortSignal): Promise<unknown>;
  /** Notifies when the underlying tool surface changes, so the console can re-discover. */
  subscribe(onChange: () => void): () => void;
}

/** Attaches Airlock's own provenance to a tool descriptor from WebMCP. */
export const toDiscovered = (raw: RawTool): DiscoveredTool => {
  const name: OriginName | undefined = originNameFor(raw.origin);
  return {
    raw,
    name: raw.name,
    profile: name ? TRUST[name] : undefined,
    claimsReadOnly: raw.annotations?.readOnlyHint === true,
    claimsUntrustedContent: raw.annotations?.untrustedContentHint === true,
  };
};
