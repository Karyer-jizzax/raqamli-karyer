import type { Lang, StatusKey } from '@karier/types';
import { LANGS } from '@karier/types';
import { currentLang, setLang, useTranslation } from '@karier/i18n';
import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';

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

export function LangSwitcher() {
  const [lang, setLangState] = useState<Lang>(currentLang());
  return (
    <div className="kk-langs">
      {LANGS.map((l) => (
        <button
          key={l}
          className={l === lang ? 'on' : ''}
          onClick={() => {
            setLang(l);
            setLangState(l);
          }}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
