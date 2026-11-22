const MARK_TONES = ['tone-forest', 'tone-slate', 'tone-teal', 'tone-indigo'];

export default function AppMark({ name = '', size = 'md' }) {
  const clean = String(name || '').replace(/\([^)]*\)/g, '').trim();
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash * 31 + clean.charCodeAt(i)) % MARK_TONES.length;
  }
  const toneClass = MARK_TONES[Math.abs(hash) % MARK_TONES.length];

  return (
    <span className={`app-mark app-mark-${size} ${toneClass}`} aria-hidden="true">
      {initials || 'AP'}
    </span>
  );
}
