import { useCallback, useSyncExternalStore } from 'react';

export const VIEWS = ['overview', 'activity', 'policies', 'origins', 'webmcp'] as const;

export type View = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<View, string> = {
  overview: 'Overview',
  activity: 'Activity',
  policies: 'Policies',
  origins: 'Origins',
  webmcp: 'WebMCP',
};

const isView = (value: string): value is View => (VIEWS as readonly string[]).includes(value);

const read = (): View => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return isView(raw) ? raw : 'overview';
};

const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};

/**
 * Which view is showing, held in the URL fragment.
 *
 * The fragment rather than component state because a judge who reloads, or who
 * is sent a link to the decision that was just blocked, should land back where
 * they were. It also keeps the browser's own back button meaningful, which is
 * the behaviour anyone expects from something shaped like an application.
 *
 * Deliberately not a router library: five views, one string, no nesting.
 */
export const useRoute = (): [View, (next: View) => void] => {
  const view = useSyncExternalStore(subscribe, read, () => 'overview' as View);
  const go = useCallback((next: View) => {
    window.location.hash = `/${next}`;
  }, []);
  return [view, go];
};
