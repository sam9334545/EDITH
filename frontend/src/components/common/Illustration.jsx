/**
 * Product illustration wrapper.
 *
 * Assets live in frontend/public/assets and are plain SVG, so they scale on every
 * screen, stay crisp, and cost almost nothing to load. Each illustration explains a
 * part of the platform — it is never decoration, and it never replaces live data.
 */
export default function Illustration({ name, alt, className = '', ...rest }) {
  return (
    <img
      src={`/assets/${name}.svg`}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable="false"
      className={className}
      {...rest}
    />
  );
}

/** Illustration beside an explanatory block. */
export function Explainer({ name, alt, title, children, reverse = false }) {
  const figure = (
    <figure className="explainer-figure">
      <Illustration name={name} alt={alt} />
    </figure>
  );
  const body = (
    <div className="explainer-body">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
  return (
    <div className="explainer">
      {reverse ? body : figure}
      {reverse ? figure : body}
    </div>
  );
}
