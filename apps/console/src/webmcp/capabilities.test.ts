import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORIGINS, type RawTool } from '@airlock/shared';
import { federationPlausible, probe, withDeadline } from './capabilities';

const CONSOLE_ORIGIN = ORIGINS.console;

const ownTool = (name: string): RawTool => ({ name, origin: CONSOLE_ORIGIN });
const partnerTool = (name: string, origin: string): RawTool => ({ name, origin });

/**
 * Installs a fake `document.modelContext` and a matching `window.location`.
 *
 * The point of these tests is the judging path: the console has to reach a
 * working page in a browser that has WebMCP but withholds the federation
 * surface, and it has to do it without waiting on calls that will never answer.
 * Both conditions are properties of code that runs before anything renders, so
 * they are checked here rather than left to whichever browser happens to be open.
 */
const install = (modelContext: unknown) => {
  const g = globalThis as Record<string, unknown>;
  g.window = { location: { origin: CONSOLE_ORIGIN } };
  g.document = modelContext === undefined ? {} : { modelContext };
};

afterEach(() => {
  vi.useRealTimers();
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

/** Chrome 149+ behind the flag: everything present, partners answer. */
const chrome = () => ({
  registerTool: async () => {},
  getTools: async (options?: { fromOrigins?: string[] }) =>
    options?.fromOrigins
      ? [ownTool('airlock_list_origins'), partnerTool('vault_read_record', ORIGINS.vault)]
      : [ownTool('airlock_list_origins')],
  executeTool: async () => '{}',
  addEventListener: () => {},
  removeEventListener: () => {},
});

/**
 * ChatGPT's in-app browser: `registerTool` works, `addEventListener` is absent,
 * and `fromOrigins` resolves with the page's own tools and no foreign ones —
 * without throwing, which is what makes it dangerous to detect by `try`/`catch`.
 */
const inApp = () => ({
  registerTool: async () => {},
  getTools: async () => [ownTool('airlock_list_origins'), ownTool('airlock_explain_decision')],
  executeTool: async () => '{}',
});

describe('probe', () => {
  it('reports nothing when the browser has no modelContext', async () => {
    install(undefined);
    const caps = await probe();
    expect(caps.present).toBe(false);
    expect(federationPlausible(caps)).toBe(false);
  });

  it('sees the full federation surface in a browser that supports it', async () => {
    install(chrome());
    const caps = await probe();
    expect(caps.present).toBe(true);
    expect(caps.toolchange).toBe(true);
    expect(caps.foreignTools).toEqual(['vault_read_record']);
    expect(caps.foreignOrigins).toEqual([ORIGINS.vault]);
    expect(federationPlausible(caps)).toBe(true);
  });

  it('reads tools this page registered back out of the browser', async () => {
    install(inApp());
    const caps = await probe();
    expect(caps.canRegister).toBe(true);
    expect(caps.ownTools).toEqual(['airlock_explain_decision', 'airlock_list_origins']);
  });

  it('does not treat a silent zero-foreign answer as federation', async () => {
    install(inApp());
    const caps = await probe();
    expect(caps.fromOriginsAnswered).toBe(true);
    expect(caps.foreignTools).toEqual([]);
    // The signal that saves several seconds of pointless retries on the browser
    // a judge is most likely to arrive in.
    expect(federationPlausible(caps)).toBe(false);
  });

  it('survives getTools rejecting', async () => {
    install({
      registerTool: async () => {},
      getTools: async () => {
        throw new Error('not supported');
      },
      executeTool: async () => '{}',
    });
    const caps = await probe();
    expect(caps.present).toBe(true);
    expect(caps.getToolsAnswered).toBe(false);
    expect(caps.ownTools).toEqual([]);
  });

  it('survives getTools throwing synchronously', async () => {
    install({
      registerTool: async () => {},
      getTools: () => {
        throw new Error('bad implementation');
      },
      executeTool: async () => '{}',
    });
    const caps = await probe();
    expect(caps.present).toBe(true);
    expect(caps.getToolsAnswered).toBe(false);
  });

  it('gives up on a getTools that never settles', async () => {
    install({
      registerTool: async () => {},
      getTools: () => new Promise<RawTool[]>(() => {}),
      executeTool: async () => '{}',
    });
    const caps = await probe();
    expect(caps.getToolsAnswered).toBe(false);
    expect(caps.fromOriginsAnswered).toBe(false);
  }, 10_000);
});

describe('withDeadline', () => {
  it('returns the fallback rather than waiting forever', async () => {
    const result = await withDeadline(new Promise<string>(() => {}), 'fallback', 20);
    expect(result).toBe('fallback');
  });

  it('leaves no unhandled rejection when the loser rejects after the deadline', async () => {
    // Reached through globalThis so this file needs no Node typings; the console
    // package is typed for the DOM and should stay that way.
    const proc = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', handler: () => void): void;
        off(event: 'unhandledRejection', handler: () => void): void;
      };
    }).process;
    const unhandled = vi.fn();
    proc.on('unhandledRejection', unhandled);
    const late = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('late')), 30));
    expect(await withDeadline(late, 'fallback', 5)).toBe('fallback');
    await new Promise((r) => setTimeout(r, 80));
    proc.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
