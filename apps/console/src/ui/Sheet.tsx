import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './primitives';

/**
 * A right-hand sheet.
 *
 * Every kind of detail in this product — a decision, a policy, an origin — is
 * about something selected somewhere else, so it all arrives the same way:
 * from the right, over a dimmed page, closed by Escape or by clicking away.
 * One motion, learned once.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-ground/70 border-0 cursor-default animate-scrim"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative w-full max-w-[540px] h-full bg-surface ring-1 ring-line
                   flex flex-col outline-none animate-sheet"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{title}</div>
            {subtitle && <div className="text-[12.5px] text-fg-3 mt-1">{subtitle}</div>}
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>

        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
