/**
 * In-page navigation link.
 *
 * Renders a real `<a href="#section">` so the destination is visible on hover,
 * can be opened in a new tab and works before JavaScript loads. A plain click
 * is routed through `onNavigate`, which owns scrolling, the buy/sell switch
 * and the active state.
 */
export function NavAnchor({ target, onNavigate, children, ...rest }) {
  const handleClick = (event) => {
    // Let the browser handle modified clicks (new tab, new window…).
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(target);
  };

  return (
    <a href={`#${target}`} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
