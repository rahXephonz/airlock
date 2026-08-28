import { ORIGINS, toDiscovered, type DiscoveredTool, type ToolResolver } from '@airlock/shared';
import { modelContext } from './types';

const PARTNERS = [ORIGINS.vault, ORIGINS.dispatch, ORIGINS.bazaar];

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

    const all = await mc.getTools({ fromOrigins: [...PARTNERS] });
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
