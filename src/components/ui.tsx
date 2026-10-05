import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { Portrait } from './Art';
import type { Artist } from '../types';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'quiet'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName };
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, children, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn btn--${variant} btn--${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function LinkButton({ href, variant = 'secondary', size = 'md', icon, iconRight, children, className = '', ...rest }: { href: string; variant?: BtnProps['variant']; size?: BtnProps['size']; icon?: IconName; iconRight?: IconName; children?: ReactNode; className?: string; target?: string; rel?: string; onClick?: () => void }) {
  return (
    <a href={href} className={`btn btn--${variant} btn--${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </a>
  );
}

export function IconButton({ icon, label, className = '', active, size = 20, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean; size?: number }) {
  return (
    <button className={`icon-btn ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Chip({ children, tone = 'plain', icon }: { children: ReactNode; tone?: 'plain' | 'green' | 'outline'; icon?: IconName }) {
  return <span className={`chip chip--${tone}`}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

export function Verified({ compact = false }: { compact?: boolean }) {
  return (
    <span className="verified" title="Verified Artist: connected Spotify artist profile">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.5l2.4 1.8l3-.2l.9 2.9l2.5 1.7l-1 2.8l1 2.8l-2.5 1.7l-.9 2.9l-3-.2L12 21.5l-2.4-1.8l-3 .2l-.9-2.9l-2.5-1.7l1-2.8l-1-2.8l2.5-1.7l.9-2.9l3 .2z" fill="var(--green)" /><path d="M8 12.2l2.7 2.7L16.2 9.4" fill="none" stroke="var(--green-ink)" strokeWidth="2" /></svg>
      {!compact && <span>Verified Artist</span>}
    </span>
  );
}

export function Avatar({ artist, size = 40, ring = false }: { artist: Artist; size?: number; ring?: boolean }) {
  return (
    <span className={`avatar ${ring ? 'avatar--ring' : ''}`} style={{ width: size, height: size }}>
      <Portrait visual={artist.photo} imageUrl={artist.imageUrl} />
    </span>
  );
}

export function AvatarPair({ a, b, size = 40 }: { a: Artist; b: Artist; size?: number }) {
  return (
    <span className="avatar-pair" style={{ height: size, width: size * 1.6 }}>
      <Avatar artist={a} size={size} />
      <Avatar artist={b} size={size} />
    </span>
  );
}

export function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span className="toggle__text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true"><span /></span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          <span>{o.label}</span>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** Modal sheet: slides up on mobile, centred panel on desktop. Esc and backdrop close it. */
export function Sheet({ open, onClose, title, children, wide = false, labelledBy }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    const el = ref.current;
    const focusables = () => el?.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    window.setTimeout(() => (focusables()?.[0] ?? el)?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = focusables();
        if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      (prev.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`sheet ${wide ? 'sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} tabIndex={-1}>
        <button className="sheet__close icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        {title && !labelledBy && <h2 className="sheet__title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SectionHead({ eyebrow, title, action, sub }: { eyebrow?: string; title: string; action?: ReactNode; sub?: string }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {sub && <p className="section-head__sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function LiveDot({ label = 'Live' }: { label?: string }) {
  return <span className="live"><i />{label}</span>;
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
