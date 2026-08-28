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
    hint: 'This was blocked by policy, not by a transient fault. Retrying the same call will be refused again. Tell the user what you were trying to do and let them decide.',
  }, null, 2);

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
  private taint: TaintSource[] = [];
  private listeners = new Set<() => void>();

  constructor(private readonly deps: MediatorDeps) {}

  taintSources = (): readonly TaintSource[] => this.taint;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly TaintSource[] => this.taint;

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /** Replaces the whole proxy surface with one built from `tools`. */
  async publish(tools: readonly DiscoveredTool[]): Promise<void> {
    const mc = modelContext();
    if (!mc) return;

    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    for (const tool of tools) {
      await mc.registerTool(this.proxyFor(tool), { signal });
    }
  }

  private proxyFor(tool: DiscoveredTool): RegisterableTool {
    const origin = tool.profile;
    const trust = origin ? TRUST[origin.name].trust : 'unknown';

    return {
      name: proxyName(tool),
      description:
        `${tool.raw.description ?? tool.name} — provided by ${origin?.name ?? 'an unclassified origin'} (${trust}), mediated by Airlock. ` +
        `Calls that move data across a trust boundary are refused, and writes require the user's confirmation.`,
      inputSchema: tool.raw.inputSchema ?? { type: 'object', properties: {} },
      // Mirrors what the origin claims so an agent sees the same surface, while
      // the policy engine ignores the claim entirely.
      ...(tool.raw.annotations ? { annotations: tool.raw.annotations } : {}),
      execute: async (args, ctx) => this.call(tool, args, ctx?.signal),
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
  ): Promise<string> {
    const { resolver, ledger, consent } = this.deps;
    const decision = evaluate({ tool, args, taintSources: this.taint });
    const origin = tool.raw.origin ?? 'unknown';

    if (decision.disposition === 'block') {
      ledger.append({ toolName: tool.name, origin, args, decision, outcome: 'blocked' });
      return refusal(decision.reasons);
    }

    if (decision.disposition === 'confirm') {
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
        outcome: decision.disposition === 'confirm' ? 'confirmed' : 'allowed',
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
