import { useEffect } from 'react';

/**
 * Highlights the navigation entry matching the section currently in view.
 *
 * `resolve(sectionId)` maps a DOM section to a navigation id so callers can
 * apply their own rules (e.g. the shared buy/sell panel).
 */
export function useScrollSpy(sectionIds, resolve) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (visible) resolve(visible.target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.2, 0.5] }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectionIds, resolve]);
}
