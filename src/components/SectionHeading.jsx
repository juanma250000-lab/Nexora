/**
 * Eyebrow + title + description block that opens every content section.
 * `children` is rendered on the opposite side (stats, actions…).
 */
export function SectionHeading({ index, titleId, title, description, children, className = '' }) {
  return (
    <header className={`nx-section-heading ${className}`.trim()}>
      <div className="nx-section-heading-copy">
        <p className="nx-eyebrow">{index}</p>
        <h2 id={titleId}>{title}</h2>
        {description && <p className="nx-section-lead">{description}</p>}
      </div>
      {children && <div className="nx-section-heading-aside">{children}</div>}
    </header>
  );
}
