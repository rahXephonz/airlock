import { ORIGINS, type RawTool } from '@airlock/shared';
import { modelContext } from './types';

/** How long any single WebMCP call is given before it is treated as unanswered. */
const PROBE_TIMEOUT_MS = 1200;

/**
 * Resolves with `fallback` if `work` has not settled in time.
 *
 * Needed because an unsupported WebMCP call does not consistently fail. Chrome
 * answers, ChatGPT's in-app browser resolves with no foreign tools, and at least
 * one Chromium build leaves the promise pending forever — which stalled
 * discovery on the very first attempt and left the console reporting that it was
 * still looking. Awaiting a promise that never settles is indistinguishable from
 * slow, so every call gets a deadline.
 *
 * The `catch` is attached to `work` itself rather than to the race. A promise
 * that loses the race and rejects afterwards is still an unhandled rejection,
 * which surfaces in the console as an error during a demo that is otherwise fine.
 */
export const withDeadline = async <T,>(work: Promise<T>, fallback: T, ms = PROBE_TIMEOUT_MS): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guarded = work.catch(() => fallback);
  try {
    return await Promise.race([
      guarded,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Calls `work` for its promise without letting a synchronous throw escape. */
const attempt = async <T,>(work: () => Promise<T>, fallback: T, ms?: number): Promise<T> => {
  try {
    return await withDeadline(work(), fallback, ms);
  } catch {
    return fallback;
  }
};

/**
 * What this browser's WebMCP implementation actually does, measured rather than
 * inferred from a version string.
 *
 * ChatGPT's in-app browser reports `Chrome/151.0.0.0` and still withholds most of
 * the federation surface, so user-agent sniffing would get this exactly backwards.
 * Every field here is the result of a call.
 */
export interface Capabilities {
  /** `document.modelContext` exists at all. */
  readonly present: boolean;
  /** `registerTool` is callable, so tools this page publishes are real. */
  readonly canRegister: boolean;
  /**
   * `addEventListener('toolchange')` exists.
   *
   * Also the fastest signal that the rest of the federation surface is present:
   * the in-app browser withholds this and cross-origin discovery together, so a
   * browser without it is not worth several seconds of retries.
   */
  readonly toolchange: boolean;
  /** `getTools()` returned rather than hanging. */
  readonly getToolsAnswered: boolean;
  /** `getTools({ fromOrigins })` returned rather than hanging. */
  readonly fromOriginsAnswered: boolean;
  /** Tools published by this page, as the browser reports them back. */
  readonly ownTools: readonly string[];
  /** Tools from any other origin, which only appear where federation works. */
  readonly foreignTools: readonly string[];
  readonly foreignOrigins: readonly string[];
}

export const EMPTY_CAPABILITIES: Capabilities = {
  present: false,
  canRegister: false,
  toolchange: false,
  getToolsAnswered: false,
  fromOriginsAnswered: false,
  ownTools: [],
  foreignTools: [],
  foreignOrigins: [],
};

const PARTNERS = [ORIGINS.vault, ORIGINS.dispatch, ORIGINS.bazaar];

/** A sentinel distinguishable from a genuine empty answer. */
const UNANSWERED = Symbol('unanswered');

const nameOf = (t: RawTool): string => t.name;
const isForeign = (t: RawTool): boolean =>
  typeof t.origin === 'string' && t.origin !== window.location.origin;

/**
 * Reads the browser's own tool registry.
 *
 * This is the only claim in the console that does not come from its own state:
 * the names below were handed back by `document.modelContext`, so a page saying
 * it registered six proxies can be checked against what the browser thinks it
 * holds. During fallback that difference is the whole point — the transport is
 * simulated, the registration is not.
 */
export const probe = async (): Promise<Capabilities> => {
  const mc = modelContext();
  if (!mc) return EMPTY_CAPABILITIES;

  const everything = await attempt<RawTool[] | typeof UNANSWERED>(
    () => mc.getTools(),
    UNANSWERED,
  );
  const federated = await attempt<RawTool[] | typeof UNANSWERED>(
    () => mc.getTools({ fromOrigins: [...PARTNERS] }),
    UNANSWERED,
  );

  // `fromOrigins` unions foreign tools with the page's own rather than filtering
  // to the origins asked for, so both answers are read for provenance from each
  // tool's own `origin` and neither is trusted to have filtered anything.
  const seen = [
    ...(everything === UNANSWERED ? [] : everything),
    ...(federated === UNANSWERED ? [] : federated),
  ];
  const byName = new Map(seen.map((t) => [`${t.origin ?? '?'}|${t.name}`, t]));
  const all = [...byName.values()];
  const foreign = all.filter(isForeign);

  return {
    present: true,
    canRegister: typeof mc.registerTool === 'function',
    toolchange: typeof mc.addEventListener === 'function',
    getToolsAnswered: everything !== UNANSWERED,
    fromOriginsAnswered: federated !== UNANSWERED,
    ownTools: all.filter((t) => !isForeign(t)).map(nameOf).sort(),
    foreignTools: foreign.map(nameOf).sort(),
    foreignOrigins: [...new Set(foreign.map((t) => t.origin!))].sort(),
  };
};

/**
 * Whether spending several seconds retrying cross-origin discovery is worth it.
 *
 * Partner tools appear only once each iframe has loaded and run its own
 * `registerTool` calls, so a browser that supports federation legitimately needs
 * a few retries. A browser that withholds `modelContext` from frames entirely
 * will never produce them, and retrying there is dead time on the one path a
 * judge is most likely to open the site on.
 */
export const federationPlausible = (caps: Capabilities): boolean =>
  caps.present && caps.toolchange;
