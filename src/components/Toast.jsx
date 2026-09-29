import { Check, CircleHelp, X } from 'lucide-react';

/** Success/error toast anchored above the mobile navigation bar. */
export function Toast({ toast, onDismiss }) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className={`nx-toast ${isError ? 'error' : 'success'}`} role="status" aria-live="polite">
      <span className="nx-toast-icon" aria-hidden="true">
        {isError ? <CircleHelp size={17} /> : <Check size={17} />}
      </span>
      <span>{toast.text}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
