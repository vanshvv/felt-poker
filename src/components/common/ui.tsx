import { useEffect, type ReactNode } from 'react';

/** A chip glyph rendered with a value. Purely visual. */
export function Chip({
  color,
  size = 34,
  label,
}: {
  color: string;
  size?: number;
  label?: string | number;
}) {
  const inner = size * 0.62;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden={label == null}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: color,
          boxShadow: `inset 0 0 0 ${size * 0.06}px rgba(255,255,255,0.14), 0 3px 6px var(--chip-shadow)`,
        }}
      />
      {/* dashed edge ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `repeating-conic-gradient(rgba(255,255,255,0.85) 0deg 12deg, transparent 12deg 30deg)`,
          WebkitMask: `radial-gradient(circle, transparent ${inner / 2}px, #000 ${inner / 2}px, #000 ${
            inner / 2 + size * 0.08
          }px, transparent ${inner / 2 + size * 0.08}px)`,
          mask: `radial-gradient(circle, transparent ${inner / 2}px, #000 ${inner / 2}px, #000 ${
            inner / 2 + size * 0.08
          }px, transparent ${inner / 2 + size * 0.08}px)`,
          opacity: 0.5,
        }}
      />
      <div
        className="absolute rounded-full flex items-center justify-center tnum font-bold"
        style={{
          inset: size * 0.19,
          background: 'rgba(0,0,0,0.28)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
          fontSize: size * 0.26,
          color: 'rgba(255,255,255,0.92)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** A short overlapping stack of denomination chips representing an amount. */
export function ChipStackView({
  chips,
  size = 26,
}: {
  chips: { color: string; value: number }[];
  size?: number;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex items-end" style={{ height: size }}>
      {chips.map((c, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.62 }}>
          <Chip color={c.color} size={size} />
        </div>
      ))}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'left';
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/55 transition-opacity"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="glass absolute top-0 bottom-0 flex flex-col max-w-[92vw]"
        style={{
          width,
          [side]: 0,
          transform: open ? 'translateX(0)' : `translateX(${side === 'right' ? '110%' : '-110%'})`,
          transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
          borderRadius: side === 'right' ? '1rem 0 0 1rem' : '0 1rem 1rem 0',
        }}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b hair">
          <h2 className="font-display text-xl text-[var(--cream)]">{title}</h2>
          <button className="btn btn-ghost !px-3 !py-1.5" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 520,
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="glass anim-pop relative w-full rounded-2xl p-5 md:p-6"
        style={{ maxWidth }}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl text-[var(--cream)]">{title}</h2>
            {onClose && (
              <button className="btn btn-ghost !px-3 !py-1.5" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'win' | 'loss' }) {
  return (
    <div className="glass rounded-xl px-3.5 py-2.5">
      <div className="text-[0.64rem] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div
        className="tnum text-lg font-semibold"
        style={{ color: tone === 'win' ? 'var(--win)' : tone === 'loss' ? 'var(--loss)' : 'var(--ink)' }}
      >
        {value}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[0.72rem] uppercase tracking-wider text-[var(--muted)] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
