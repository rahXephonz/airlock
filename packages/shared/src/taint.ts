import type { OriginName } from './origins';

/**
 * A value that came out of a tool whose output an attacker can influence.
 *
 * Airlock tracks these because the interesting attack is not a single bad call.
 * It is a chain: read from an origin that emits untrusted text, then carry some
 * of that text into a write on a different origin. The taint is what makes the
 * second call recognisable as the tail of the first.
 */
export interface TaintSource {
  readonly id: string;
  /** Origin whose tool produced the value. */
  readonly origin: OriginName;
  readonly toolName: string;
  readonly at: number;
  /** The raw output, kept so later arguments can be matched against it. */
  readonly text: string;
}

/**
 * Shortest run of characters that counts as carried-over text.
 *
 * Too low and every argument matches on incidental words like "the order";
 * too high and an attacker escapes by having the agent drop a word. Matching
 * runs on normalised text, so re-casing and re-spacing do not help.
 */
const MIN_MATCH = 12;

/** Bounds the quadratic scan below; tool output longer than this is truncated. */
const MAX_SCAN = 8000;

const normalise = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Longest run of characters present in both strings.
 *
 * Fragment-splitting was tried first and did not survive contact with a real
 * agent: it only matched when whole sentences were copied, and an agent that
 * lifts just the account reference out of a paragraph slipped straight past it.
 * A common-substring scan matches whatever the agent actually carried, at
 * whatever granularity it chose to carry it.
 *
 * Rolling rows keep this to O(n) memory; both inputs are capped by MAX_SCAN.
 */
const longestCommonSubstring = (a: string, b: string): string => {
  const s1 = a.slice(0, MAX_SCAN);
  const s2 = b.slice(0, MAX_SCAN);
  if (!s1 || !s2) return '';

  let prev = new Uint32Array(s2.length + 1);
  let curr = new Uint32Array(s2.length + 1);
  let bestLen = 0;
  let bestEnd = 0;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        const len = (prev[j - 1] ?? 0) + 1;
        curr[j] = len;
        if (len > bestLen) {
          bestLen = len;
          bestEnd = i;
        }
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return bestLen >= MIN_MATCH ? s1.slice(bestEnd - bestLen, bestEnd) : '';
};

export interface TaintMatch {
  readonly source: TaintSource;
  /** The text found in both the tool output and the outgoing argument. */
  readonly fragment: string;
}

/**
 * Find tainted text carried into an outgoing argument value.
 *
 * This is deliberately a heuristic and is described as one in the UI. It cannot
 * catch an agent that paraphrases, and it is not trying to: the policy decision
 * rests on origin trust and the shape of the call, and a taint match is what
 * lets Airlock explain *why* in terms a user can check. Detection that failed
 * open would be a different design.
 */
export const findTaint = (args: unknown, sources: readonly TaintSource[]): TaintMatch[] => {
  const haystack = normalise(typeof args === 'string' ? args : JSON.stringify(args ?? ''));
  const matches: TaintMatch[] = [];

  for (const source of sources) {
    const fragment = longestCommonSubstring(normalise(source.text), haystack);
    if (fragment) matches.push({ source, fragment: fragment.trim() });
  }

  return matches;
};

let counter = 0;

export const recordTaint = (
  origin: OriginName,
  toolName: string,
  text: string,
): TaintSource => ({
  id: `taint-${++counter}`,
  origin,
  toolName,
  at: Date.now(),
  text,
});
