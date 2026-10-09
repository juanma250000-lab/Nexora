import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { scrollBehavior } from '../lib/format';
import { TOUR_STEPS } from '../lib/tourSteps';

const MOBILE_QUERY = '(max-width: 640px)';
/** Breathing room between the highlighted element and the spotlight edge. */
const SPOT_PADDING = 8;
/** Distance between the spotlight and the popover. */
const POPOVER_GAP = 14;
/** Space kept clear for the sticky header when scrolling a target into view. */
const HEADER_OFFSET = 96;
const EDGE = 12;

const isMobile = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches;

/** First selector that resolves to an element that is actually rendered. */
function findTarget(selectors) {
  for (const selector of selectors || []) {
    const element = document.querySelector(selector);
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

/** Sticky and fixed chrome (header, mobile bar) is always on screen already. */
function isPinned(element) {
  return Boolean(element.closest('.nx-header, .nx-mobile-nav'));
}

function scrollToTarget(element) {
  if (isPinned(element)) return;
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight;
  // On phones the popover is a bottom sheet, so the target lives in the top half.
  const room = (isMobile() ? viewport * 0.5 : viewport) - HEADER_OFFSET;
  const centring = rect.height < room ? (room - rect.height) / 2 : 0;
  window.scrollTo({
    top: Math.max(0, window.scrollY + rect.top - HEADER_OFFSET - centring),
    behavior: scrollBehavior(),
  });
}

/**
 * Picks below / above / right / left of the spotlight, whichever fits first,
 * and falls back to the bottom-right corner when nothing does.
 */
function placePopover(spot, width, height) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x) => Math.min(Math.max(EDGE, x), vw - width - EDGE);
  const clampY = (y) => Math.min(Math.max(EDGE, y), vh - height - EDGE);
  const centreX = spot.left + spot.width / 2 - width / 2;
  const centreY = spot.top + spot.height / 2 - height / 2;

  if (spot.bottom + POPOVER_GAP + height <= vh - EDGE) {
    return { left: clampX(centreX), top: spot.bottom + POPOVER_GAP };
  }
  if (spot.top - POPOVER_GAP - height >= EDGE) {
    return { left: clampX(centreX), top: spot.top - POPOVER_GAP - height };
  }
  if (spot.right + POPOVER_GAP + width <= vw - EDGE) {
    return { left: spot.right + POPOVER_GAP, top: clampY(centreY) };
  }
  if (spot.left - POPOVER_GAP - width >= EDGE) {
    return { left: spot.left - POPOVER_GAP - width, top: clampY(centreY) };
  }
  return { left: vw - width - EDGE * 2, top: vh - height - EDGE * 2 };
}

/**
 * Lightweight guided tour: a dimmed overlay with a spotlight on the element
 * being explained and a popover with the step copy.
 *
 * Keyboard: Escape closes, the arrow keys move between steps and Tab stays
 * inside the popover. On phones the popover becomes a bottom sheet. Steps
 * whose target is not rendered (another viewport, empty market…) are shown
 * centred instead of pointing at nothing.
 */
export function GuidedTour({ onFinish, steps = TOUR_STEPS }) {
  const [index, setIndex] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);
  const spotRef = useRef(null);
  const popoverRef = useRef(null);
  const titleRef = useRef(null);
  const targetRef = useRef(null);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const skip = useCallback(() => onFinish(isLast ? 'completado' : 'omitido'), [isLast, onFinish]);
  const dialogRef = useDialog(true, skip);

  const next = useCallback(() => {
    if (isLast) onFinish('completado');
    else setIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [isLast, onFinish, steps.length]);

  const previous = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), []);

  /** Positions spotlight and popover from the live geometry of the target. */
  const layout = useCallback(() => {
    const spotNode = spotRef.current;
    const popover = popoverRef.current;
    if (!spotNode || !popover) return;

    const target = targetRef.current;
    if (!target || !target.isConnected) {
      popover.style.left = '';
      popover.style.top = '';
      return;
    }

    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Clamp to the viewport: tall sections must not push the ring off screen.
    const top = Math.max(rect.top - SPOT_PADDING, 4);
    const left = Math.max(rect.left - SPOT_PADDING, 4);
    const bottom = Math.min(rect.bottom + SPOT_PADDING, vh - 4);
    const right = Math.min(rect.right + SPOT_PADDING, vw - 4);
    const spot = {
      top,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      bottom,
      right,
    };

    Object.assign(spotNode.style, {
      top: `${spot.top}px`,
      left: `${spot.left}px`,
      width: `${spot.width}px`,
      height: `${spot.height}px`,
    });

    if (isMobile()) {
      popover.style.left = '';
      popover.style.top = '';
      return;
    }
    const position = placePopover(spot, popover.offsetWidth, popover.offsetHeight);
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;
  }, []);

  // Resolve the target of the current step and bring it into view.
  useLayoutEffect(() => {
    const target = findTarget(step.target);
    targetRef.current = target;
    setHasTarget(Boolean(target));
    if (target) scrollToTarget(target);
    layout();
  }, [step, layout]);

  // Move focus to the step title so screen readers announce every step.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [index]);

  // Keep the spotlight glued to its target while scrolling or resizing.
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(layout);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [layout]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
    }
  };

  const progress = ((index + 1) / steps.length) * 100;

  return (
    <div className={`nx-tour ${hasTarget ? '' : 'is-centered'}`.trim()} role="presentation">
      <div ref={spotRef} className="nx-tour-spot" aria-hidden="true" />

      <section
        ref={(node) => {
          popoverRef.current = node;
          dialogRef.current = node;
        }}
        className="nx-tour-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nx-tour-title"
        aria-describedby="nx-tour-body"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="nx-tour-top">
          <span className="nx-tour-count">
            Paso {index + 1} de {steps.length}
          </span>
          <button className="nx-tour-close" type="button" aria-label="Cerrar la guía" onClick={skip}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          className="nx-tour-progress"
          role="progressbar"
          aria-label="Progreso de la guía"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Paso ${index + 1} de ${steps.length}`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        <h2 id="nx-tour-title" ref={titleRef} tabIndex={-1}>
          {step.title}
        </h2>
        <p id="nx-tour-body">{step.body}</p>

        <div className="nx-tour-actions">
          {!isLast ? (
            <button className="nx-text-action nx-tour-skip" type="button" onClick={skip}>
              Saltar guía
            </button>
          ) : (
            <span />
          )}
          <div className="nx-tour-nav">
            <button
              className="nx-button nx-button-quiet"
              type="button"
              onClick={previous}
              disabled={isFirst}
            >
              <ArrowLeft size={15} aria-hidden="true" /> Anterior
            </button>
            <button className="nx-button nx-button-primary" type="button" onClick={next}>
              {isLast ? (
                <>
                  Finalizar <Check size={15} aria-hidden="true" />
                </>
              ) : (
                <>
                  Siguiente <ArrowRight size={15} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Small first-visit card that offers the tour without forcing it. */
export function TourInvite({ onStart, onDismiss }) {
  return (
    <aside className="nx-tour-invite" aria-label="Guía de uso">
      <span className="nx-tour-invite-icon" aria-hidden="true">
        <Compass size={19} />
      </span>
      <p>
        <b>¿Primera vez en NEXORA?</b>
        <span>Haz un recorrido de un minuto por las funciones principales.</span>
      </p>
      <div>
        <button className="nx-button nx-button-primary" type="button" onClick={onStart}>
          Empezar guía
        </button>
        <button className="nx-button nx-button-quiet" type="button" onClick={onDismiss}>
          Ahora no
        </button>
      </div>
    </aside>
  );
}
