import {
  TRUST,
  evaluate,
  recordTaint,
  type DiscoveredTool,
  type ToolResolver,
  type TaintSource,
} from '@airlock/shared';
import { modelContext, type RegisterableTool } from './types';
import type { Ledger } from '../state/ledger';
import type { ConsentQueue } from '../state/consent';

const proxyName = (tool: DiscoveredTool): string =>
  `airlock_${tool.profile?.name ?? 'unknown'}_${tool.name.replace(/^[a-z]+_/, '')}`;

/**
 * Explains a refusal to the agent in terms it can act on.
 *
 * A blocked call is not a failure the agent should retry; it is a boundary it
 * should not have approached. Saying so plainly, and naming the origins
 * involved, is more useful than an opaque error and stops the agent burning
 * turns rephrasing the same request.
 */
const refusal = (reasons: readonly { code: string; detail: string }[]): string =>
  JSON.stringify({
    error: 'Airlock refused this call.',
    reasons: reasons.map((r) => r.detail),
    hint: 'This was blocked by policy, not by a transient fault. Retrying the same call will be refused again, and there is no argument you can pass to bypass it. Tell the user what you were trying to do. If they still want it, they can release it themselves from the Airlock console, where the provenance is shown.',
  }, null, 2);

export interface PublishReport {
  readonly registered: number;
  readonly failures: readonly string[];
}

export interface MediatorDeps {
  readonly resolver: ToolResolver;
  readonly ledger: Ledger;
  readonly consent: ConsentQueue;
}

/**
 * Registers one Airlock-owned proxy per discovered partner tool.
 *
 * The agent is given these proxies and never the partner tools themselves, so
 * policy is not advice the agent may take — it is the only path to the
 * capability. Every proxy is torn down and rebuilt when discovery changes, so
 * the surface an agent sees always matches what the partners currently offer.
 */
export class Mediator {
  private controller: AbortController | undefined;
  /** Names currently published, so an unchanged surface is not republished. */
  private signature = '';
  private lastReport: PublishReport = { registered: 0, failures: [] };
  private publishing: Promise<PublishReport> | undefined;
  private taint: TaintSource[] = [];
  private listeners = new Set<() => void>();

  constructor(private readonly deps: MediatorDeps) {}

  taintSources = (): readonly TaintSource[] => this.taint;

  /**
   * Withdraws every proxy this mediator published.
   *
   * Without it a replaced mediator leaves its surface registered, and the
   * replacement collides with its predecessor on every name — reported as
   * "Duplicate tool name", which reads like a bug in the partner rather than
   * a mediator that was never torn down.
   */
  dispose = (): void => {
    this.controller?.abort();
    this.controller = undefined;
    this.signature = '';
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly TaintSource[] => this.taint;

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Replaces the whole proxy surface with one built from `tools`.
   *
   * Failures are collected rather than thrown. One partner publishing a tool
   * this browser will not accept must not cost the agent every other tool, and
   * an early throw here previously took the console's own status reporting down
   * with it — leaving a page that had discovered everything successfully still
   * claiming it was looking.
   */
  async publish(tools: readonly DiscoveredTool[]): Promise<PublishReport> {
    const mc = modelContext();
    if (!mc) return { registered: 0, failures: ['WebMCP is not available in this browser.'] };

    // Registering a proxy itself changes the tool list, which fires toolchange,
    // which asks for another publish. Without a check for whether the surface
    // actually differs, the console republishes in response to its own writes
    // and collides with the names it just claimed.
    const signature = tools
      .map((t) => `${t.raw.origin ?? '?'}|${t.name}`)
      .sort()
      .join(',');
    if (signature === this.signature && this.controller) return this.lastReport;

    // Concurrent publishes would race for the same names, so they queue.
    if (this.publishing) await this.publishing.catch(() => undefined);

    this.publishing = this.republish(tools, signature);
    try {
      return await this.publishing;
    } finally {
      this.publishing = undefined;
    }
  }

  private async republish(
    tools: readonly DiscoveredTool[],
    signature: string,
  ): Promise<PublishReport> {
    const mc = modelContext()!;
    this.controller?.abort();
    // Unregistration is observed to complete out of band, so the surface is
    // given a turn to clear before the replacement claims the same names.
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.controller = new AbortController();
    const { signal } = this.controller;

    let registered = 0;
    const failures: string[] = [];

    for (const tool of tools) {
      try {
        await mc.registerTool(this.proxyFor(tool), { signal });
        registered++;
      } catch (err) {
        failures.push(`${proxyName(tool)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.signature = signature;
    this.lastReport = { registered, failures };
    return this.lastReport;
  }

  private proxyFor(tool: DiscoveredTool): RegisterableTool {
    const origin = tool.profile;
    const trust = origin ? TRUST[origin.name].trust : 'unknown';

    return {
      name: proxyName(tool),
      description:
        `${tool.raw.description ?? tool.name} — provided by ${origin?.name ?? 'an unclassified origin'} (${trust}), mediated by Airlock. ` +
        `Calls that move data across a trust boundary are refused, and writes require the user's confirmation.`,
      inputSchema: tool.inputSchema,
      // Mirrors what the origin claims so an agent sees the same surface, while
      // the policy engine ignores the claim entirely.
      ...(tool.raw.annotations ? { annotations: tool.raw.annotations } : {}),
      execute: async (args, ctx) => this.call(tool, args, ctx?.signal, false),
    };
  }

  /**
   * Runs one call through policy.
   *
   * Public because the console drives the same path when a person clicks a
   * tool, not only when an agent calls a proxy. A second entry point that
   * skipped policy would be a hole in the only thing this project claims.
   */
  async call(
    tool: DiscoveredTool,
    args: Record<string, unknown>,
    outerSignal: AbortSignal | undefined,
    /**
     * Releases a call policy blocked.
     *
     * Only ever passed by the console's own UI, after a person has been shown
     * the provenance in Airlock's words. It is deliberately not reachable from a
     * proxy: an agent that could ask for its own refusal to be lifted would make
     * the policy advice rather than enforcement, which is the whole distinction
     * this project rests on.
     */
    override = false,
  ): Promise<string> {
    const { resolver, ledger, consent } = this.deps;
    const decision = evaluate({ tool, args, taintSources: this.taint });
    const origin = tool.raw.origin ?? 'unknown';

    if (decision.disposition === 'block' && !override) {
      ledger.append({ toolName: tool.name, origin, args, decision, outcome: 'blocked' });
      return refusal(decision.reasons);
    }

    if (decision.disposition === 'confirm' && !override) {
      const approved = await consent.ask(tool, args, decision);
      if (!approved) {
        ledger.append({ toolName: tool.name, origin, args, decision, outcome: 'declined' });
        return refusal([{
          code: 'user-declined',
          detail: 'The user was shown this call and declined it.',
        }]);
      }
    }

    const controller = new AbortController();
    outerSignal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const raw = await resolver.execute(tool, args, controller.signal);
      const result = typeof raw === 'string' ? raw : JSON.stringify(raw);

      // Anything out of an origin that emits attacker-influenceable text is
      // tainted from here on, so a later write carrying it is recognisable as
      // the tail of this call rather than an unrelated request.
      if (tool.profile?.emitsUntrustedContent || tool.claimsUntrustedContent) {
        this.taint = [...this.taint, recordTaint(tool.profile!.name, tool.name, result)];
        this.notify();
      }

      ledger.append({
        toolName: tool.name,
        origin,
        args,
        decision,
        outcome: override
          ? 'overridden'
          : decision.disposition === 'confirm' ? 'confirmed' : 'allowed',
        result: result.slice(0, 2000),
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ledger.append({
        toolName: tool.name, origin, args, decision, outcome: 'failed', error: message,
      });
      return JSON.stringify({
        error: `The call to ${tool.name} on ${origin} did not complete.`,
        detail: message,
        hint: 'This is a transient fault on the partner origin, not a policy refusal. It is safe to retry once.',
      }, null, 2);
    }
  }
}
