import { ORIGINS, toDiscovered, type DiscoveredTool, type ToolResolver } from '@airlock/shared';
import { modelContext } from './types';

const PARTNERS = [ORIGINS.vault, ORIGINS.dispatch, ORIGINS.bazaar];

/** How long a discovery call is given before it is treated as unanswered. */
const DISCOVERY_TIMEOUT_MS = 1500;

/**
 * Resolves with `fallback` if `work` has not settled in time.
 *
 * Needed because an unsupported `getTools({ fromOrigins })` does not
 * consistently fail. Chrome answers, ChatGPT's in-app browser resolves with no
 * foreign tools, and at least one Chromium build leaves the promise pending
 * forever — which stalled discovery on the very first attempt and left the
 * console reporting that it was still looking. Awaiting a promise that never
 * settles is indistinguishable from slow, so it is given a deadline.
 */
const withDeadline = async <T,>(work: Promise<T>, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), DISCOVERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Discovers tools published by the partner origins embedded in this page.
 *
 * Two behaviours observed during the spike shape this, and both would be easy
 * to get wrong from the documentation alone:
 *
 * 1. `fromOrigins` *unions* foreign tools with the page's own rather than
 *    filtering to the origins asked for, so provenance is taken from each
 *    tool's own `origin` and the console's own proxies are excluded here.
 * 2. Where cross-origin discovery is unsupported the call **resolves with no
 *    foreign tools instead of throwing**, so unavailability is detected by
 *    counting what came back, never by catching an error.
 */
export class CrossOriginResolver implements ToolResolver {
  readonly id = 'cross-origin';
  readonly label = 'Cross-origin WebMCP (getTools fromOrigins)';

  async discover(): Promise<DiscoveredTool[]> {
    const mc = modelContext();
    if (!mc) return [];

    const all = await withDeadline(mc.getTools({ fromOrigins: [...PARTNERS] }), []);
    return all
      .filter((t) => typeof t.origin === 'string' && t.origin !== window.location.origin)
      .map(toDiscovered);
  }

  async execute(tool: DiscoveredTool, args: unknown, signal: AbortSignal): Promise<unknown> {
    const mc = modelContext();
    if (!mc) throw new Error('WebMCP is not available in this browser.');
    return mc.executeTool(tool.raw, JSON.stringify(args ?? {}), { signal });
  }

  subscribe(onChange: () => void): () => void {
    const mc = modelContext();
    // Absent in ChatGPT's in-app browser. Where it is missing the console
    // re-discovers on an explicit refresh instead of silently going stale.
    if (!mc?.addEventListener) return () => {};
    mc.addEventListener('toolchange', onChange);
    return () => mc.removeEventListener?.('toolchange', onChange);
  }
}
