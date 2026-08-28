import type { ReactNode } from 'react';
import type { TrustLevel } from '@airlock/shared';

/**
 * Shared class strings.
 *
 * Kept here rather than repeated inline so a panel, a badge or a section label
 * looks the same everywhere it appears — the utilities are the styling layer,
 * but consistency still has to be a decision someone made once.
 */
export const PANEL = 'bg-panel border border-seam rounded-[3px]';

export const LABEL =
  'font-mono text-[11.5px] font-medium tracking-[0.16em] uppercase text-ink-3';

const TAG_BASE =
  'inline-block font-mono text-[11px] font-medium px-2 py-[2px] rounded-[2px] ' +
  'border whitespace-nowrap';

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

export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${TAG_BASE} ${TAG_TONE[tone]}`}>{children}</span>;
}

export function Section({
  label,
  lede,
  children,
}: {
  label: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-16">
      <h2 className={`${LABEL} mb-2`}>{label}</h2>
      {lede && <p className="text-ink-2 mb-5 max-w-[70ch]">{lede}</p>}
      {children}
    </section>
  );
}

const BUTTON_BASE =
  'text-sm font-normal rounded-[2px] px-4 py-[9px] border cursor-pointer ' +
  'transition-colors disabled:opacity-35 disabled:cursor-default';

const BUTTON_TONE = {
  quiet: 'bg-panel-2 border-seam-2 text-ink hover:not-disabled:border-[#3a4b5c]',
  primary: 'bg-[#14302a] border-[#2b5548] text-[#bdf0e0] hover:not-disabled:border-trusted',
  danger: 'bg-[#331a1a] border-[#5a2e2e] text-[#f3c6c6] hover:not-disabled:border-blocked',
} as const;

export function Button({
  tone = 'quiet',
  ...props
}: { tone?: keyof typeof BUTTON_TONE } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${BUTTON_BASE} ${BUTTON_TONE[tone]}`} />;
}
