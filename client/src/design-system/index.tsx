import type { HTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/** Semantic surface; changing material never introduces extra DOM wrappers. */
export function GlassSurface({
  as: Tag = 'div',
  level = 'panel',
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer';
  level?: 'panel' | 'chrome' | 'overlay';
}) {
  return <Tag className={`glass glass--${level} ${className}`} {...props} />;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'subtle' }) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}

export function BrandMark() {
  return (
    <span className="brand-icon" aria-hidden="true">
      i<span className="brand-glint" />
    </span>
  );
}

export function StudioFooter() {
  return (
    <GlassSurface as="footer" className="page-footer">
      <span>Uma presença consistente começa com uma boa identidade.</span>
      <span>
        Identify <span aria-hidden="true">✦</span>
      </span>
    </GlassSurface>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Automatic activation with roving focus: arrows, Home and End. */
export function Tabs({
  label,
  items,
  value,
  onChange,
  panelId,
}: {
  label: string;
  items: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  panelId: string;
}) {
  return (
    <div className="editor-tabs" role="tablist" aria-label={label}>
      {items.map(([key, text], index) => (
        <button
          key={key}
          type="button"
          role="tab"
          id={`${panelId}-tab-${key}`}
          aria-controls={panelId}
          aria-selected={value === key}
          tabIndex={value === key ? 0 : -1}
          className={value === key ? 'active' : ''}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : event.key === 'ArrowRight'
                    ? (index + 1) % items.length
                    : event.key === 'ArrowLeft'
                      ? (index - 1 + items.length) % items.length
                      : undefined;
            if (next === undefined) return;
            event.preventDefault();
            onChange(items[next][0]);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next].focus();
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
