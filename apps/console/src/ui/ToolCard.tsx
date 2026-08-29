import { useMemo, useState } from 'react';
import { detectOverreach, type DiscoveredTool, type JsonSchema } from '@airlock/shared';
import { Button, LABEL, PANEL, Tag, toneForTrust } from './primitives';

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
  'w-full bg-[#0b1218] border border-seam-2 rounded-[2px] px-2.5 py-[7px] ' +
  'font-mono text-[13px] text-ink outline-none focus:border-self';

/**
 * One discovered tool, with what its origin claims and what Airlock concluded
 * shown side by side.
 *
 * Keeping the two visually distinct is the point: a reader should be able to see
 * that "read-only" is something the origin said, not something anyone verified.
 *
 * Arguments are collected in the card rather than through `window.prompt`. A
 * native prompt blocks the whole page while it is open, is styled by the browser
 * rather than by us, and is suppressed outright in some embedded webviews — one
 * of which is the browser this demo most needs to survive.
 */
export function ToolCard({ tool, onRun }: {
  tool: DiscoveredTool;
  onRun: (tool: DiscoveredTool, args: Record<string, unknown>) => void;
}) {
  const overreach = detectOverreach(tool);
  const contested =
    tool.claimsReadOnly && WRITE_VERB.test(tool.name.replace(/^[a-z]+_/, ''));

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
    <div className={`${PANEL} px-4 py-3.5`}>
      <div className="grid grid-cols-[1fr_auto] gap-3.5 items-start">
        <div className="min-w-0">
          <span className="font-mono text-sm font-medium break-all">{tool.name}</span>
          <p className="text-ink-2 text-[13.5px] mt-1 max-w-[74ch]">{tool.raw.description}</p>

          <div className="flex gap-1.5 flex-wrap mt-2.5">
            <Tag tone={toneForTrust(tool.profile?.trust)}>
              {tool.profile?.name ?? 'unclassified'} · {tool.profile?.trust ?? 'unknown'}
            </Tag>
            {tool.claimsReadOnly && (
              <Tag tone={contested ? 'bad' : 'neutral'}>
                {contested ? 'claims read-only — contested' : 'claims read-only'}
              </Tag>
            )}
            {tool.claimsUntrustedContent && <Tag tone="semi">emits untrusted content</Tag>}
            {overreach.map((o) => (
              <Tag key={o.field} tone="bad">overreach: {o.field}</Tag>
            ))}
          </div>
        </div>

        <Button
          onClick={() => (fields.length === 0 ? onRun(tool, {}) : setOpen((v) => !v))}
          aria-expanded={fields.length === 0 ? undefined : open}
        >
          {fields.length === 0 ? 'Call' : open ? 'Cancel' : 'Call…'}
        </Button>
      </div>

      {open && fields.length > 0 && (
        <form
          className="mt-4 pt-3.5 border-t border-seam grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className={LABEL}>Arguments</p>
          {fields.map((f) => (
            <label key={f.name} className="grid gap-1.5">
              <span className="font-mono text-[12.5px] text-ink">
                {f.name}
                {f.required && <span className="text-semi"> *</span>}
                {overreached.has(f.name) && (
                  <span className="text-blocked"> — not justified by this tool's purpose</span>
                )}
              </span>
              {f.schema.description && (
                <span className="text-ink-3 text-[12.5px]">{f.schema.description}</span>
              )}
              {f.schema.enum ? (
                <select
                  className={INPUT}
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
          <div className="flex gap-2.5 flex-wrap">
            <Button type="submit" tone="primary" disabled={missing}>
              Run through Airlock
            </Button>
            {missing && (
              <span className="text-ink-3 text-[13px] self-center">
                Fill the required arguments first.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
