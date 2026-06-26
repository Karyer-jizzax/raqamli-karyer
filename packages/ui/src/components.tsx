import type { Lang, StatusKey } from '@karier/types';
import { LANGS } from '@karier/types';
import { currentLang, setLang, useTranslation } from '@karier/i18n';
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return <button className={`kk-btn ${variant === 'ghost' ? 'ghost' : ''} ${className}`} {...rest} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`kk-card ${className}`}>{children}</div>;
}

export function StatusPill({ status }: { status: StatusKey }) {
  const { t } = useTranslation();
  return <span className={`kk-status ${status}`}>{t(`status_${status}`)}</span>;
}

const LANG_LABELS: Record<Lang, string> = {
  'uz-latn': 'UZ',
  'uz-cyrl': 'ЎЗ',
  ru: 'RU',
};

const LANG_NAMES: Record<Lang, string> = {
  'uz-latn': "O'zbekcha",
  'uz-cyrl': 'Ўзбекча',
  ru: 'Русский',
};

export function LangSwitcher() {
  const [lang, setLangState] = useState<Lang>(currentLang());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          border: '1px solid var(--line)',
          borderRadius: 8,
          background: '#fff',
          cursor: 'pointer',
          font: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          color: '#23364a',
        }}
      >
        {LANG_LABELS[lang]}
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.16)',
            minWidth: 150,
            overflow: 'hidden',
            zIndex: 40,
          }}
        >
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                setLangState(l);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '9px 14px',
                border: 'none',
                background: l === lang ? 'var(--bg, #f1f5f9)' : 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 13,
                color: '#23364a',
                fontWeight: l === lang ? 700 : 500,
              }}
            >
              <span style={{ width: 24, color: 'var(--muted)', fontSize: 12 }}>{LANG_LABELS[l]}</span>
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
