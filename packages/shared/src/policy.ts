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

/**
 * The rules `evaluate` implements, as data.
 *
 * The console needs to show what policy exists before anything has run, and a
 * page that described the rules in prose would be describing them a second time
 * — free to drift from the code the moment either changed. So the table lives
 * beside the function it documents, keyed by the same reason codes `evaluate`
 * emits, and a test asserts that every code the engine can produce appears here.
 *
 * These are the policy engine's rules. Nothing generates them, and nothing
 * consults a model to decide which applies.
 */
export interface PolicyRule {
  /** The `Reason.code` this rule produces, so decisions can be traced to it. */
  readonly code: string;
  readonly name: string;
  /** What the rule looks at on the way in. */
  readonly source: string;
  /** What it protects. */
  readonly target: string;
  readonly disposition: Disposition;
  readonly condition: string;
}

export const POLICY_RULES: readonly PolicyRule[] = [
  {
    code: 'cross-origin-exfiltration',
    name: 'Cross-trust-boundary write',
    source: 'Untrusted-content origin',
    target: 'Write on another origin',
    disposition: 'block',
    condition:
      'An argument carries text that came out of a tool on an origin that emits attacker-influenceable content, and the call writes somewhere else.',
  },
  {
    code: 'unknown-origin',
    name: 'Unclassified origin',
    source: 'Any origin with no trust classification',
    target: 'Any capability',
    disposition: 'block',
    condition: 'The tool arrived from an origin the operator has never classified.',
  },
  {
    code: 'contested-readonly',
    name: 'Contested read-only claim',
    source: 'Foreign origin',
    target: 'Any capability',
    disposition: 'confirm',
    condition:
      'The tool is annotated readOnlyHint but its shape says it writes. The claim is unverifiable across an origin boundary, so Airlock treats it as a write.',
  },
  {
    code: 'parameter-overreach',
    name: 'Parameter overreach',
    source: 'Any origin',
    target: 'Any capability',
    disposition: 'confirm',
    condition:
      'The input schema asks for a sensitive field the tool’s stated purpose does not mention. Detected at discovery, before any call.',
  },
  {
    code: 'write-action',
    name: 'Untainted write',
    source: 'Clean provenance',
    target: 'Write on a trusted origin',
    disposition: 'confirm',
    condition: 'A real, irreversible action with no tainted value in its arguments. The user decides.',
  },
  {
    code: 'read-only',
    name: 'Read',
    source: 'Any classified origin',
    target: 'Read-only capability',
    disposition: 'allow',
    condition: 'A read that moves nothing across a trust boundary.',
  },
];
