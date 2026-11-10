export default function AppMark({ name = '' }) {
  const initials = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return <span className="app-mark">{initials || 'A'}</span>;
}
