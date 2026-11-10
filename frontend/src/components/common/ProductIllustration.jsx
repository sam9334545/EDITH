import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function ProductIllustration({
  src,
  alt,
  eyebrow,
  title,
  caption,
  variant = 'side',
  className = '',
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`illustration-frame illustration-${variant} ${className}`}>
      <div className="illustration-visual">
        {!failed ? (
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="illustration-fallback" aria-label={alt}>
            <ShieldCheck size={34} strokeWidth={1.6} aria-hidden="true" />
            <span>{title || 'E.D.I.T.H. Security Architecture'}</span>
          </div>
        )}
      </div>
      {(eyebrow || title || caption) && (
        <figcaption className="illustration-caption">
          {eyebrow && <span className="illustration-eyebrow">{eyebrow}</span>}
          {title && <strong>{title}</strong>}
          {caption && <p>{caption}</p>}
        </figcaption>
      )}
    </figure>
  );
}

