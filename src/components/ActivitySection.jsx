import { memo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Clock3, ShieldCheck } from 'lucide-react';
import { formatCOP, formatCrypto, formatTimestamp } from '../lib/format';

/** Entries visible before the list is expanded. */
const COLLAPSED_COUNT = 4;

function ActivitySectionImpl({ activity, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  // Older entries used to be unreachable: only the latest four were rendered.
  const visible = expanded ? activity : activity.slice(0, COLLAPSED_COUNT);
  const hiddenCount = activity.length - COLLAPSED_COUNT;

  return (
    <section
      className="nx-section nx-activity-section"
      id="actividad"
      aria-labelledby="nx-activity-title"
    >
      <div className="nx-section-heading">
        <div>
          <span className="nx-section-index">
            <span className="nx-section-number">05</span> Registro
          </span>
          <h2 id="nx-activity-title">
            Cada movimiento,
            <br className="nx-mobile-break" /> <span>en perspectiva.</span>
          </h2>
          <p className="nx-section-lead">
            Historial local de las operaciones simuladas en este dispositivo.
          </p>
        </div>

        {/* A label, not a button: it used to look clickable but only raised a toast. */}
        <p className="nx-demo-badge">
          <ShieldCheck size={15} aria-hidden="true" /> Solo demostración
        </p>
      </div>

      <div className="nx-activity-list" data-tour="activity">
        {visible.length ? (
          <>
            {visible.map((item) => (
              <article className="nx-activity-row" key={item.id}>
                <span
                  className={`nx-activity-icon ${item.type === 'buy' ? 'is-buy' : 'is-sell'}`.trim()}
                  aria-hidden="true"
                >
                  {item.type === 'buy' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                </span>

                <span className="nx-activity-copy">
                  <b>
                    {item.type === 'buy' ? 'Compra simulada' : 'Venta simulada'} de {item.name}
                  </b>
                  <small>
                    {formatTimestamp(item.date)} · <span className="nx-activity-id">{item.id}</span>
                  </small>
                </span>

                <span className="nx-activity-quantity">
                  {item.type === 'buy' ? '+' : '−'}
                  {formatCrypto(item.quantity)} {item.symbol}
                </span>

                <span className="nx-activity-value">
                  {formatCOP(item.total)}
                  <small>Valor de referencia</small>
                </span>
              </article>
            ))}

            {hiddenCount > 0 && (
              <button
                className="nx-text-action nx-activity-toggle"
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'Ver menos' : `Ver todo el historial (${hiddenCount} más)`}
              </button>
            )}
          </>
        ) : (
          <div className="nx-empty-state nx-activity-empty">
            <span className="nx-empty-mark">
              <Clock3 size={22} aria-hidden="true" />
            </span>
            <h3>Aún no hay movimientos.</h3>
            <p>Las compras y ventas de prueba aparecerán aquí.</p>
            <button className="nx-text-action" type="button" onClick={() => onNavigate('mercado')}>
              Descubrir activos <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const ActivitySection = memo(ActivitySectionImpl);
