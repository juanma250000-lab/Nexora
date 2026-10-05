import { RotateCcw } from 'lucide-react';
import { INITIAL_CASH } from '../lib/constants';
import { formatCOP } from '../lib/format';
import { ModalShell } from './ModalShell';

/** Destructive action on local data, so it always asks first. */
export function ResetPortfolioModal({ onClose, onConfirm }) {
  return (
    <ModalShell onClose={onClose} labelledBy="nx-reset-title" describedBy="nx-reset-description">
      <div className="nx-modal-mark is-warning" aria-hidden="true">
        <RotateCcw size={20} />
      </div>
      <p className="nx-eyebrow">Portafolio de prueba</p>
      <h2 id="nx-reset-title">¿Restablecer el portafolio?</h2>
      <p id="nx-reset-description">
        Volverás a las posiciones iniciales y a un saldo de {formatCOP(INITIAL_CASH)}. Se borrará el
        historial de movimientos simulados guardado en este navegador.
      </p>

      <div className="nx-modal-actions">
        <button className="nx-button nx-button-secondary" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="nx-button nx-button-danger" type="button" onClick={onConfirm}>
          <RotateCcw size={15} aria-hidden="true" /> Sí, restablecer
        </button>
      </div>
    </ModalShell>
  );
}
