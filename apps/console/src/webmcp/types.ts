import type { RawTool } from '@airlock/shared';

/**
 * The slice of `document.modelContext` Airlock actually uses.
 *
 * Declared locally rather than pulled from a typings package because the two
 * browsers we target disagree about what exists — `addEventListener` is absent
 * in ChatGPT's in-app browser — and every optional member here marks a place
 * the console has to cope with absence rather than assume support.
 */
export interface ModelContext {
  registerTool(tool: RegisterableTool, options?: RegisterOptions): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RawTool[]>;
  executeTool(tool: RawTool, inputJson: string, options?: { signal?: AbortSignal }): Promise<unknown>;
  addEventListener?(type: 'toolchange', handler: () => void): void;
  removeEventListener?(type: 'toolchange', handler: () => void): void;
}

export interface RegisterableTool {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (args: Record<string, unknown>, ctx?: { signal?: AbortSignal }) => Promise<string>;
}

export interface RegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export const modelContext = (): ModelContext | undefined =>
  (document as unknown as { modelContext?: ModelContext }).modelContext;

export type { RawTool };
