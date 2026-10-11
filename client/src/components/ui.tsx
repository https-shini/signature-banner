import { Button } from '../design-system';
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { X, LoaderCircle } from 'lucide-react';
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'modal ' + (wide ? 'modal-wide' : '')}
      aria-labelledby={id}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const dialog = event.currentTarget;
        const controls = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== 'hidden',
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === dialog)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <Button
          variant="subtle"
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const directControl =
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type);
  return (
    <div className="field">
      {directControl ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
      {directControl
        ? cloneElement(children as ReactElement<{ id: string; 'aria-describedby'?: string }>, {
            id,
            'aria-describedby': hint ? id + '-hint' : undefined,
          })
        : children}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">✦</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Busy() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} /> Carregando seu espaço…
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      {message}
    </div>
  );
}
