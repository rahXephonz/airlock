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
  /**
   * The descriptor exactly as WebMCP handed it over.
   *
   * Kept by reference because `executeTool` needs the original object; a copy
   * is not accepted in its place.
   */
  readonly raw: RawTool;
  /**
   * The tool's input schema, rebuilt as ordinary data.
   *
   * A schema that arrives across an origin boundary is not a plain object and
   * cannot be read back or handed to `registerTool` — attempting it fails with
   * "Failed to convert value to 'object'", which silently cost every mediated
   * proxy. Reading it field by field into real data is what makes the schema
   * usable for both re-registration and inspection.
   */
  readonly inputSchema: JsonSchema;
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

/**
 * Rebuilds a value from another origin as ordinary data.
 *
 * Property access can throw, and the objects themselves are not plain, so each
 * read is guarded and anything unreadable is dropped rather than allowed to
 * poison the result.
 */
const plainify = (value: unknown, depth = 0): unknown => {
  if (depth > 8 || value === null) return value;

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type !== 'object') return undefined;

  try {
    if (Array.isArray(value)) {
      return value.map((item) => plainify(item, depth + 1)).filter((item) => item !== undefined);
    }

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      try {
        const converted = plainify((value as Record<string, unknown>)[key], depth + 1);
        if (converted !== undefined) out[key] = converted;
      } catch {
        // A single unreadable property should not lose the rest of the schema.
      }
    }
    return out;
  } catch {
    return undefined;
  }
};

const EMPTY_SCHEMA: JsonSchema = { type: 'object', properties: {}, additionalProperties: false };

/**
 * Reads a foreign tool's schema into data that can be re-registered.
 *
 * Across an origin boundary the schema arrives as a JSON string rather than the
 * object it is same-origin. Nothing signals the change — property access simply
 * yields character indices — so both forms are accepted.
 */
export const normaliseSchema = (schema: unknown): JsonSchema => {
  const source = typeof schema === 'string'
    ? ((): unknown => {
        try {
          return JSON.parse(schema);
        } catch {
          return undefined;
        }
      })()
    : schema;

  const plain = plainify(source);
  if (plain && typeof plain === 'object' && !Array.isArray(plain)) {
    const candidate = plain as JsonSchema;
    return candidate.properties || candidate.type ? candidate : EMPTY_SCHEMA;
  }
  return EMPTY_SCHEMA;
};

/** Attaches Airlock's own provenance to a tool descriptor from WebMCP. */
export const toDiscovered = (raw: RawTool): DiscoveredTool => {
  const name: OriginName | undefined = originNameFor(raw.origin);
  return {
    raw,
    inputSchema: normaliseSchema(raw.inputSchema),
    name: raw.name,
    profile: name ? TRUST[name] : undefined,
    claimsReadOnly: raw.annotations?.readOnlyHint === true,
    claimsUntrustedContent: raw.annotations?.untrustedContentHint === true,
  };
};
