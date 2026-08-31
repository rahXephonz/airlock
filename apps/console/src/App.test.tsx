import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

/**
 * The shell, rendered once.
 *
 * Not a substitute for opening the page, but it catches the class of failure
 * that would be worst to find during a demo: a crash on first paint, before any
 * effect has run and before discovery has answered. Every store the app reads
 * synchronously has to survive an empty session.
 */
beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  const store = new Map<string, string>();
  g.window = {
    location: { origin: 'https://airlock-console.netlify.app', search: '', hash: '' },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = {};
});

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

describe('the console', () => {
  it('renders the overview before anything has been discovered', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Capability firewall for the agentic web.');
    expect(html).toContain('Trust flow');
    expect(html).toContain('Run attack demo');
    // The five views are reachable from the first paint.
    for (const label of ['Overview', 'Activity', 'Policies', 'Origins', 'WebMCP']) {
      expect(html).toContain(label);
    }
    // Nothing has run, so nothing may claim a decision.
    expect(html).not.toContain('BLOCKED');
    expect(html).toContain('No calls mediated yet');
  });

  it('offers the rail collapse, labelled for a keyboard user', () => {
    const html = renderToStaticMarkup(<App />);

    // The rail starts expanded when storage says nothing, and the control that
    // narrows it is a real button with a name rather than a bare icon.
    expect(html).toContain('Collapse the sidebar');
    expect(html).toContain('WebMCP security');
  });

  it('keeps the partner frames mounted while they are off-view', () => {
    const html = renderToStaticMarkup(<App />);
    // Overview is showing, so the frames are hidden — but present, because
    // unmounting them would tear down the federated surface.
    expect(html).toContain('invisible absolute');
    expect(html).toContain('allow="tools"');
  });
});
