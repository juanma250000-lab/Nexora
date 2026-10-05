import { Check, CircleAlert, X } from 'lucide-react';

/**
 * Success/error toast. The live region wrapper stays mounted so screen
 * readers reliably announce each new message.
 */
export function Toast({ toast, onDismiss }) {
  const isError = toast?.type === 'error';

  return (
    <div className="nx-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className={`nx-toast ${isError ? 'is-error' : 'is-success'}`} key={toast.id}>
          <span className="nx-toast-icon" aria-hidden="true">
            {isError ? <CircleAlert size={17} /> : <Check size={17} />}
          </span>
          <span className="nx-toast-text">{toast.text}</span>
          <button className="nx-icon-button is-ghost" type="button" aria-label="Cerrar aviso" onClick={onDismiss}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
