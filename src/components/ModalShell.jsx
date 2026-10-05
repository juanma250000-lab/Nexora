import { X } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

/**
 * Shared modal frame: backdrop, Escape/scroll/focus handling and the
 * close affordance. The parent decides when to mount it.
 */
export function ModalShell({ onClose, labelledBy, describedBy, variant = '', children }) {
  const dialogRef = useDialog(true, onClose);

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="nx-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className={`nx-modal ${variant}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        <button className="nx-modal-close nx-icon-button" type="button" aria-label="Cerrar" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  );
}
