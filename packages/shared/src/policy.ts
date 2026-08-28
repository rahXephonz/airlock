import { TRUST, type OriginName } from './origins';
import type { DiscoveredTool } from './resolver';
import { findTaint, type TaintMatch, type TaintSource } from './taint';

export type Disposition = 'allow' | 'confirm' | 'block';

export interface Reason {
  readonly code: string;
  /** Written for the user, in terms of what Airlock observed rather than jargon. */
  readonly detail: string;
}

export interface Decision {
  readonly disposition: Disposition;
  readonly reasons: readonly Reason[];
  readonly taint: readonly TaintMatch[];
  /**
   * Airlock's own judgement of whether this call mutates something, derived from
   * origin trust and tool shape. Never taken from a foreign `readOnlyHint`.
   */
  readonly treatedAsWrite: boolean;
}

/**
 * Does this call mutate something?
 *
 * A foreign origin's `readOnlyHint` is an unverified claim by the tool author,
 * and the spec authors say so plainly: a tool tagged read-only can still write.
 * So the hint is never an input here. For our own origin we can rely on the
 * annotation because we wrote it; for everyone else we decide from the tool's
 * name and the fact that it accepts arguments at all.
 */
const looksLikeWrite = (tool: DiscoveredTool): boolean => {
  if (tool.profile?.trust === 'self') return !tool.claimsReadOnly;

  const verb = /^(publish|send|post|order|create|update|delete|write|pay|transfer|share|submit|remove|set)/;
  const bare = tool.name.replace(/^[a-z]+_/, '');
  return verb.test(tool.name) || verb.test(bare);
};

/**
 * Fields a tool asks for that its stated purpose does not justify.
 *
 * Cheap to compute because discovery already hands us every `inputSchema`, and
 * it catches the case where a foreign origin quietly widens what it collects
 * without changing anything a user would notice.
 */
const SENSITIVE_FIELDS = [
  'address', 'ssn', 'passport', 'dob', 'birth', 'card', 'cvv', 'iban',
  'password', 'token', 'secret', 'apikey', 'api_key', 'phone', 'location',
  'latitude', 'longitude', 'salary', 'income',
];

export interface Overreach {
  readonly field: string;
  readonly why: string;
}

export const detectOverreach = (tool: DiscoveredTool): Overreach[] => {
  const props = tool.inputSchema.properties ?? {};
  const purpose = `${tool.name} ${tool.raw.description ?? ''}`.toLowerCase();

  return Object.keys(props).flatMap((field) => {
    const key = field.toLowerCase().replace(/[^a-z]/g, '');
    const hit = SENSITIVE_FIELDS.find((s) => key.includes(s.replace(/[^a-z]/g, '')));
    if (!hit) return [];
    // If the tool's own description is about that thing, asking for it is honest.
    if (purpose.includes(hit)) return [];
    return [{
      field,
      why: `asks for "${field}", which its stated purpose does not mention`,
    }];
  });
};

export interface EvaluateInput {
  readonly tool: DiscoveredTool;
  readonly args: unknown;
  readonly taintSources: readonly TaintSource[];
}

/**
 * Decide what happens to one call, before it runs.
 *
 * Ordering matters: the strictest reason wins, and every reason is kept so the
 * console can show the whole basis rather than just the headline.
 */
export const evaluate = ({ tool, args, taintSources }: EvaluateInput): Decision => {
  const reasons: Reason[] = [];
  const treatedAsWrite = looksLikeWrite(tool);
  const origin: OriginName | undefined = tool.profile?.name;
  const taint = treatedAsWrite ? findTaint(args, taintSources) : [];

  if (!origin) {
    return {
      disposition: 'block',
      treatedAsWrite,
      taint,
      reasons: [{
        code: 'unknown-origin',
        detail: `Tool "${tool.name}" came from ${tool.raw.origin ?? 'an unidentified origin'}, which is not one of the origins you have classified.`,
      }],
    };
  }

  if (tool.claimsReadOnly && treatedAsWrite && tool.profile?.trust !== 'self') {
    reasons.push({
      code: 'contested-readonly',
      detail: `${origin} claims this tool is read-only, but its shape says it writes. Airlock is treating it as a write; the claim is not verifiable across an origin boundary.`,
    });
  }

  for (const o of detectOverreach(tool)) {
    reasons.push({
      code: 'parameter-overreach',
      detail: `${tool.name} ${o.why}.`,
    });
  }

  // The case the whole project exists for: text from an origin that emits
  // attacker-influenceable content, arriving as an argument to a write
  // somewhere else.
  const crossOrigin = taint.filter((m) => m.source.origin !== origin);
  if (crossOrigin.length > 0) {
    for (const m of crossOrigin) {
      reasons.push({
        code: 'cross-origin-exfiltration',
        detail: `This value contains text that came out of ${m.source.toolName} on ${m.source.origin}, an origin you marked ${TRUST[m.source.origin].trust}. Sending it through a write on ${origin} moves data across a trust boundary you did not ask to cross.`,
      });
    }
    return { disposition: 'block', reasons, taint, treatedAsWrite };
  }

  if (treatedAsWrite) {
    reasons.push({
      code: 'write-action',
      detail: `${tool.name} performs a real action on ${origin} and cannot be undone.`,
    });
    return { disposition: 'confirm', reasons, taint, treatedAsWrite };
  }

  if (reasons.length > 0) return { disposition: 'confirm', reasons, taint, treatedAsWrite };

  return {
    disposition: 'allow',
    treatedAsWrite,
    taint,
    reasons: [{
      code: 'read-only',
      detail: `Read-only call to ${origin}. No data leaves a trust boundary.`,
    }],
  };
};
