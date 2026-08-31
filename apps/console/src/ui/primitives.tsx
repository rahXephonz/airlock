import type { ComponentType, ReactNode } from 'react';

/** A lucide icon, or anything shaped like one. */
export type IconComponent = ComponentType<{ className?: string | undefined }>;
import type { Disposition, TrustLevel } from '@airlock/shared';

/**
 * The visual language, in one file.
 *
 * Three rules hold it together. Surfaces are separated by luminance before they
 * are separated by borders. Colour is spent only on trust, taint and refusal.
 * And a label is a label — sentence case, muted, normal tracking — because
 * wide-tracked uppercase everywhere is the tell of an interface that was
 * assembled rather than designed.
 */

export type Tone = 'neutral' | 'trusted' | 'semi' | 'blocked' | 'system';

export const toneForTrust = (trust: TrustLevel | undefined): Tone =>
  trust === 'self' ? 'system'
    : trust === 'trusted' ? 'trusted'
    : trust === 'semi-trusted' ? 'semi'
    : 'neutral';

export const toneForDisposition = (d: Disposition): Tone =>
  d === 'block' ? 'blocked' : d === 'confirm' ? 'semi' : 'trusted';

export const TEXT_TONE: Record<Tone, string> = {
  neutral: 'text-fg-3',
  trusted: 'text-trusted',
  semi: 'text-semi',
  blocked: 'text-blocked',
  system: 'text-system',
};

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-fg-4',
  trusted: 'bg-trusted',
  semi: 'bg-semi',
  blocked: 'bg-blocked',
  system: 'bg-system',
};

/** A status dot. Never alone: whatever it marks is also written out in words. */
export function Dot({ tone = 'neutral', hollow = false }: { tone?: Tone; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        hollow
          ? 'inline-block size-[5px] rounded-full ring-1 ring-line-3'
          : `inline-block size-[5px] rounded-full ${DOT_TONE[tone]}`
      }
    />
  );
}

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-2',
  trusted: 'bg-trusted-tint text-trusted',
  semi: 'bg-semi-tint text-semi',
  blocked: 'bg-blocked-tint text-blocked',
  system: 'bg-system-tint text-system',
};

/** A tinted pill. Filled, not outlined — outlines read as terminal chrome. */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: IconComponent | undefined;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11.5px]
                  font-medium leading-[18px] ${BADGE_TONE[tone]}`}
    >
      {Icon && <Icon className="size-3 shrink-0" />}
      {children}
    </span>
  );
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap ' +
  'cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-default ' +
  'disabled:pointer-events-none';

const BUTTON_VARIANT = {
  primary: 'bg-fg text-ground hover:bg-fg/90',
  secondary: 'bg-surface-2 text-fg ring-1 ring-inset ring-line-2 hover:bg-surface-3',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-2',
  destructive: 'bg-blocked-tint text-blocked ring-1 ring-inset ring-blocked/25 hover:bg-blocked/15',
} as const;

const BUTTON_SIZE = {
  sm: 'h-7 px-2.5 text-[12.5px]',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-3.5 text-[13.5px]',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...props
}: {
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  icon?: IconComponent | undefined;
  children?: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`}
    >
      {Icon && <Icon className={size === 'lg' ? 'size-4 shrink-0' : 'size-3.5 shrink-0'} />}
      {children}
    </button>
  );
}

/** A raised surface. No border by default — luminance is the separation. */
export function Surface({
  children,
  className = '',
  inset = true,
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div
      className={`bg-surface rounded-md ring-1 ring-line ${inset ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A section heading.
 *
 * Sentence case, medium weight, muted. Reserved uppercase for genuinely
 * technical metadata and nowhere else.
 */
export function SectionTitle({
  children,
  action,
  className = '',
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <h3 className="text-[13px] font-medium text-fg-2 m-0">{children}</h3>
      {action}
    </div>
  );
}

/** A view heading: the name of the surface, one line of what it is. */
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
    <header className="flex gap-6 items-start justify-between flex-wrap mb-6">
      <div>
        <h2 className="text-[19px] font-semibold m-0">{title}</h2>
        {lede && <p className="text-fg-3 text-[13px] mt-1.5 max-w-[68ch] leading-[1.6]">{lede}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </header>
  );
}

export function Separator({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-line m-0 ${className}`} />;
}

/** Label/value pairs. Values monospace only when they are identifiers. */
export function Facts({
  rows,
  columns = 1,
}: {
  rows: readonly (readonly [string, ReactNode])[];
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={`m-0 grid gap-x-8 gap-y-3 ${
        columns === 2 ? 'grid-cols-[repeat(auto-fit,minmax(140px,1fr))]' : 'grid-cols-1'
      }`}
    >
      {rows.map(([k, v]) => (
        <div key={k} className={columns === 2 ? '' : 'grid grid-cols-[minmax(0,13ch)_1fr] gap-4'}>
          <dt className="text-[12.5px] text-fg-3">{k}</dt>
          <dd className="m-0 text-[13px] text-fg break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Monospace, for identifiers only. */
export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[12.5px] ${className}`}>{children}</span>;
}

/** Table shell. Row separators only; no cell borders, no outer box. */
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
                className="text-left text-[12px] font-medium text-fg-3 px-3 py-2
                           border-b border-line whitespace-nowrap first:pl-4 last:pr-4"
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
 * The row responds to a click because that is what anyone expects of a log, but
 * it is not given a button role: a `<tr>` claiming to be a button costs a screen
 * reader the table semantics that make a log readable. The keyboard path is a
 * real button inside the first cell — see `RowButton`.
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
        'border-b border-line last:border-b-0 transition-colors duration-150',
        onSelect ? 'cursor-pointer hover:bg-surface-2' : '',
        selected ? 'bg-surface-2' : '',
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
        'bg-transparent border-0 p-0 text-left cursor-pointer text-fg',
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
        'px-3 py-2.5 align-middle first:pl-4 last:pr-4',
        mono ? 'font-mono text-[12.5px]' : '',
        muted ? 'text-fg-3' : 'text-fg-2',
        wide ? '' : 'whitespace-nowrap',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

/**
 * An empty state.
 *
 * A surface with nothing in it should say what would be there and how to get
 * it. Blank space that looks like a bug is worse than density.
 */
export function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon?: IconComponent | undefined;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      {Icon && <Icon className="size-5 text-fg-4 mb-3" />}
      <p className="text-[13.5px] text-fg-2 m-0">{title}</p>
      {detail && <p className="text-[12.5px] text-fg-4 mt-1.5 max-w-[42ch] m-0">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
