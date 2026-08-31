import { useMemo, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { detectOverreach, type DiscoveredTool, type JsonSchema } from '@airlock/shared';
import { Badge, Button, SectionTitle } from './primitives';

const WRITE_VERB =
  /^(publish|send|post|order|create|update|delete|write|pay|transfer|share|submit|remove|set)/;

interface Field {
  readonly name: string;
  readonly schema: JsonSchema & { description?: string };
  readonly required: boolean;
}

const fieldsOf = (tool: DiscoveredTool): Field[] => {
  const props = tool.inputSchema.properties ?? {};
  const required = new Set(tool.inputSchema.required ?? []);
  return Object.entries(props).map(([name, schema]) => ({
    name,
    schema,
    required: required.has(name),
  }));
};

/** First enum value, so a form opens on something valid rather than on nothing. */
const suggestionFor = (f: Field): string =>
  f.schema.enum?.[0] !== undefined ? String(f.schema.enum[0]) : '';

const INPUT =
  'w-full h-8 bg-surface-2 rounded-sm ring-1 ring-inset ring-line-2 px-2.5 ' +
  'font-mono text-[12.5px] text-fg outline-none focus:ring-system';

/**
 * One discovered capability, with what its origin claims and what Airlock
 * concluded shown side by side.
 *
 * Keeping the two visually distinct is the point: a reader should see that
 * "read-only" is something the origin said, not something anyone verified.
 *
 * Arguments are collected here rather than through `window.prompt`, which
 * blocks the page, is styled by the browser, and is suppressed outright in some
 * embedded webviews — one of which is the browser this demo most needs.
 */
export function ToolCard({
  tool,
  onRun,
}: {
  tool: DiscoveredTool;
  onRun: (tool: DiscoveredTool, args: Record<string, unknown>) => void;
}) {
  const overreach = detectOverreach(tool);
  const contested = tool.claimsReadOnly && WRITE_VERB.test(tool.name.replace(/^[a-z]+_/, ''));

  const fields = useMemo(() => fieldsOf(tool), [tool]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fieldsOf(tool).map((f) => [f.name, suggestionFor(f)])),
  );

  const overreached = new Set(overreach.map((o) => o.field));
  const missing = fields.some((f) => f.required && !values[f.name]?.trim());

  const submit = () => {
    const args: Record<string, unknown> = {};
    for (const f of fields) {
      const value = values[f.name]?.trim();
      if (value) args[f.name] = value;
    }
    onRun(tool, args);
  };

  return (
    <div className="bg-surface-2 rounded-sm px-3.5 py-3">
      <div className="flex gap-3 items-start justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] text-fg m-0 break-all">{tool.name}</p>
          <p className="text-[12.5px] text-fg-3 mt-1 m-0 leading-[1.55]">{tool.raw.description}</p>
        </div>
        <Button
          size="sm"
          icon={Play}
          onClick={() => (fields.length === 0 ? onRun(tool, {}) : setOpen((v) => !v))}
          aria-expanded={fields.length === 0 ? undefined : open}
        >
          {fields.length === 0 ? 'Call' : open ? 'Cancel' : 'Call'}
        </Button>
      </div>

      {(tool.claimsReadOnly || tool.claimsUntrustedContent || overreach.length > 0) && (
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {tool.claimsReadOnly && (
            <Badge
              tone={contested ? 'blocked' : 'neutral'}
              icon={contested ? AlertTriangle : undefined}
            >
              {contested ? 'claims read-only — contested' : 'claims read-only'}
            </Badge>
          )}
          {tool.claimsUntrustedContent && <Badge tone="semi">emits untrusted content</Badge>}
          {overreach.map((o) => (
            <Badge key={o.field} tone="blocked" icon={AlertTriangle}>
              overreach: {o.field}
            </Badge>
          ))}
        </div>
      )}

      {open && fields.length > 0 && (
        <form
          className="mt-3.5 pt-3.5 border-t border-line grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <SectionTitle>Arguments</SectionTitle>
          {fields.map((f) => (
            <label key={f.name} className="grid gap-1.5">
              <span className="font-mono text-[12px] text-fg-2">
                {f.name}
                {f.required && <span className="text-semi"> *</span>}
                {overreached.has(f.name) && (
                  <span className="text-blocked font-sans"> — not justified by its purpose</span>
                )}
              </span>
              {f.schema.description && (
                <span className="text-[12px] text-fg-4">{f.schema.description}</span>
              )}
              {f.schema.enum ? (
                <select
                  className={`${INPUT} select cursor-pointer`}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                >
                  <option value="">— not set —</option>
                  {f.schema.enum.map((option) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={INPUT}
                  value={values[f.name] ?? ''}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              )}
            </label>
          ))}
          <div className="flex gap-2 items-center flex-wrap">
            <Button type="submit" size="sm" variant="primary" disabled={missing}>
              Run through Airlock
            </Button>
            {missing && (
              <span className="text-[12px] text-fg-4">Fill the required arguments first.</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
