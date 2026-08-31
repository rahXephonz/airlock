import type { ReactNode } from 'react';
import type { Disposition, TrustLevel } from '@airlock/shared';

/**
 * Shared class strings and the smallest shared elements.
 *
 * Kept here rather than repeated inline so a panel, a badge or a section label
 * looks the same everywhere it appears — the utilities are the styling layer,
 * but consistency still has to be a decision someone made once.
 *
 * The palette is deliberately almost monochrome. Green, amber and red mean
 * trusted, tainted and refused, and nothing else in the interface is allowed to
 * use them; scarcity is what makes a red row read as a security event rather
 * than as decoration.
 */
export const PANEL = 'bg-panel border border-seam rounded-[3px]';

export const LABEL =
  'font-mono text-[11px] font-medium tracking-[0.16em] uppercase text-ink-3';

const TAG_BASE =
  'inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-1.5 py-[2px] ' +
  'rounded-[2px] border whitespace-nowrap';

const TAG_TONE = {
  neutral: 'border-seam-2 text-ink-3',
  self: 'border-self-dim text-self',
  trusted: 'border-trusted-dim text-trusted',
  semi: 'border-semi-dim text-semi',
  bad: 'border-blocked-dim text-blocked',
} as const;

export type Tone = keyof typeof TAG_TONE;

export const toneForTrust = (trust: TrustLevel | undefined): Tone =>
  trust === 'self' ? 'self'
    : trust === 'trusted' ? 'trusted'
    : trust === 'semi-trusted' ? 'semi'
    : 'bad';

export const toneForDisposition = (d: Disposition): Tone =>
  d === 'block' ? 'bad' : d === 'confirm' ? 'semi' : 'trusted';

export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${TAG_BASE} ${TAG_TONE[tone]}`}>{children}</span>;
}

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  self: 'bg-self',
  trusted: 'bg-trusted',
  semi: 'bg-semi',
  bad: 'bg-blocked',
};

/**
 * A status dot.
 *
 * Never used alone: every state it marks is also written out in words, because
 * colour is not a channel everyone receives.
 */
export function Dot({ tone = 'neutral', hollow = false }: { tone?: Tone; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        hollow
          ? 'inline-block w-1.5 h-1.5 rounded-full border border-ink-3'
          : `inline-block w-1.5 h-1.5 rounded-full ${DOT_TONE[tone]}`
      }
    />
  );
}

const BUTTON_BASE =
  'inline-flex items-center gap-2 text-[13px] font-normal rounded-[2px] px-3 py-[7px] ' +
  'border cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default';

const BUTTON_TONE = {
  quiet: 'bg-panel-2 border-seam-2 text-ink hover:not-disabled:border-[#3a4b5c]',
  primary: 'bg-[#14302a] border-[#2b5548] text-[#bdf0e0] hover:not-disabled:border-trusted',
  danger: 'bg-[#331a1a] border-[#5a2e2e] text-[#f3c6c6] hover:not-disabled:border-blocked',
  ghost: 'bg-transparent border-transparent text-ink-2 hover:not-disabled:text-ink hover:not-disabled:border-seam-2',
} as const;

export function Button({
  tone = 'quiet',
  ...props
}: { tone?: keyof typeof BUTTON_TONE } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${BUTTON_BASE} ${BUTTON_TONE[tone]}`} />;
}

/**
 * A view header.
 *
 * One line of what this surface is, and nothing else. Explanation belongs in a
 * drawer or in the README; a control plane that opens with three paragraphs is
 * documentation wearing an application's clothes.
 */
export function ViewHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex gap-4 items-start justify-between flex-wrap mb-5">
      <div>
        <h2 className="text-[17px] font-semibold m-0 tracking-[-0.01em]">{title}</h2>
        {lede && <p className="text-ink-3 text-[13px] mt-1 max-w-[74ch]">{lede}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </header>
  );
}

/** A titled block inside a view. Quieter than a card: one hairline, no shadow. */
export function Panel({
  label,
  actions,
  children,
  padded = true,
}: {
  label?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={PANEL}>
      {(label || actions) && (
        <div className="flex gap-3 items-center justify-between px-4 py-2.5 border-b border-seam">
          {label && <h3 className={LABEL}>{label}</h3>}
          {actions}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

/** Label/value pairs, aligned on one column, monospace on the value side. */
export function Facts({
  rows,
}: {
  rows: readonly (readonly [string, ReactNode])[];
}) {
  return (
    <dl className="grid grid-cols-[minmax(0,15ch)_minmax(0,1fr)] gap-x-4 m-0">
      {rows.map(([k, v], i) => (
        <div key={k} className="contents">
          <dt
            className={`text-[12px] text-ink-3 py-[7px] ${i > 0 ? 'border-t border-seam' : ''}`}
          >
            {k}
          </dt>
          <dd
            className={`m-0 font-mono text-[12.5px] text-ink py-[7px] break-words ${
              i > 0 ? 'border-t border-seam' : ''
            }`}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Table shell. Wrapped so a narrow viewport scrolls the table, not the page. */
export function Table({
  head,
  children,
  label,
}: {
  head: readonly string[];
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" aria-label={label}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className={`${LABEL} text-left font-medium px-4 py-2 border-b border-seam whitespace-nowrap`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * A selectable table row.
 *
 * The whole row responds to a click because that is what anyone expects of a
 * log, but the row itself is not given a button role: a `<tr>` that claims to be
 * a button costs a screen-reader user the table semantics that make a log
 * readable. The keyboard path is a real button inside the first cell instead —
 * see `RowButton` — so both kinds of user reach the same drawer.
 */
export function Row({
  onSelect,
  selected = false,
  children,
}: {
  onSelect?: () => void;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <tr
      {...(onSelect ? { onClick: onSelect } : {})}
      className={[
        'border-b border-seam last:border-b-0 transition-colors',
        onSelect ? 'cursor-pointer hover:bg-panel-2' : '',
        selected ? 'bg-panel-2' : '',
      ].join(' ')}
    >
      {children}
    </tr>
  );
}

/** The keyboard-reachable half of a selectable row. */
export function RowButton({
  onSelect,
  mono = false,
  children,
}: {
  onSelect: () => void;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // The row handles the click too; without this the same selection fires twice.
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={[
        'bg-transparent border-0 p-0 text-left cursor-pointer text-ink',
        'hover:text-ink underline-offset-2 hover:underline',
        mono ? 'font-mono text-[12.5px]' : 'text-[13px]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function Cell({
  children,
  mono = false,
  muted = false,
  wide = false,
}: {
  children: ReactNode;
  mono?: boolean;
  muted?: boolean;
  wide?: boolean;
}) {
  return (
    <td
      className={[
        'px-4 py-2.5 align-middle',
        mono ? 'font-mono text-[12.5px]' : '',
        muted ? 'text-ink-3' : 'text-ink',
        wide ? '' : 'whitespace-nowrap',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-3 text-[13px] px-4 py-6 text-center m-0">{children}</p>;
}
