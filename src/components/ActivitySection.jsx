import { memo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, Clock3, ShieldCheck } from 'lucide-react';
import { formatCOP, formatCrypto, formatTimestamp } from '../lib/format';
import { NavAnchor } from './NavAnchor';
import { SectionHeading } from './SectionHeading';

/** Rows shown before the list is expanded. */
const PREVIEW_COUNT = 4;

function ActivitySectionImpl({ activity, onNavigate, onNotice }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? activity : activity.slice(0, PREVIEW_COUNT);
  const hidden = activity.length - PREVIEW_COUNT;

  return (
    <section className="nx-section nx-activity-section" id="actividad" aria-labelledby="nx-activity-title">
      <SectionHeading
        index="05 · Registro"
        titleId="nx-activity-title"
        title="Cada movimiento, en perspectiva."
        description="Historial local de las operaciones simuladas en este dispositivo."
      >
        <button className="nx-button nx-button-secondary" type="button" onClick={onNotice}>
          <ShieldCheck size={15} aria-hidden="true" /> Solo demostración
        </button>
      </SectionHeading>

      <div className="nx-panel nx-activity-panel">
        {visible.length ? (
          <>
            <ul className="nx-activity-list" id="nx-activity-list">
              {visible.map((item) => {
                const isBuy = item.type === 'buy';
                return (
                  <li className="nx-activity-row" key={item.id}>
                    <span className={`nx-activity-icon ${isBuy ? 'is-buy' : 'is-sell'}`} aria-hidden="true">
                      {isBuy ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </span>

                    <span className="nx-activity-copy">
                      <b>
                        {isBuy ? 'Compra simulada' : 'Venta simulada'} de {item.name}
                      </b>
                      <small>
                        {formatTimestamp(item.date)} · {item.id}
                      </small>
                    </span>

                    <span className={`nx-activity-quantity ${isBuy ? 'is-buy' : 'is-sell'}`}>
                      {isBuy ? '+' : '−'}
                      {formatCrypto(item.quantity)} {item.symbol}
                    </span>

                    <span className="nx-activity-value">
                      {formatCOP(item.total)}
                      <small>Valor de referencia</small>
                    </span>
                  </li>
                );
              })}
            </ul>

            {hidden > 0 && (
              <button
                className="nx-activity-toggle"
                type="button"
                aria-expanded={expanded}
                aria-controls="nx-activity-list"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'Mostrar menos' : `Ver ${hidden} movimiento${hidden === 1 ? '' : 's'} más`}
                <ChevronDown size={15} aria-hidden="true" className={expanded ? 'is-flipped' : undefined} />
              </button>
            )}
          </>
        ) : (
          <div className="nx-empty-state is-centered">
            <span className="nx-empty-mark" aria-hidden="true">
              <Clock3 size={22} />
            </span>
            <h3>Aún no hay movimientos.</h3>
            <p>Las compras y ventas de prueba aparecerán aquí.</p>
            <NavAnchor className="nx-text-action" target="mercado" onNavigate={onNavigate}>
              Descubrir activos <ArrowRight size={15} aria-hidden="true" />
            </NavAnchor>
          </div>
        )}
      </div>
    </section>
  );
}

/** Memoised: section props are stable, so heavy tables and charts only re-render when their data changes. */
export const ActivitySection = memo(ActivitySectionImpl);
