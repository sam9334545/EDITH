/**
 * Inline SVG icon set.
 *
 * Replaces emoji in product surfaces: emoji render differently on every platform and
 * read as informal in a security console. These inherit currentColor and stay crisp
 * at any size. Stroke-based, 24x24 grid, consistent 1.8 weight.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export function ShieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9 12l2 2.2L15.2 10" />
    </svg>
  );
}

export function DnaIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3c0 4.5 10 6 10 10.5" />
      <path d="M17 3c0 4.5-10 6-10 10.5" />
      <path d="M7 21c0-3.2 10-4.3 10-7.5" />
      <path d="M17 21c0-3.2-10-4.3-10-7.5" />
      <path d="M8.6 7h6.8M8 17h8" />
    </svg>
  );
}

export function PulseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h3.5l2.2-6 3.4 12 2.4-7 1.6 3H21" />
    </svg>
  );
}

export function RadarIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 12l6-4" />
    </svg>
  );
}

export function LayersIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l8.5 4.5L12 12 3.5 7.5z" />
      <path d="M3.5 12.2L12 16.7l8.5-4.5" />
      <path d="M3.5 16.6L12 21.1l8.5-4.5" />
    </svg>
  );
}

export function KeyholeIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.2a4 4 0 118 0V10" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function AlertIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5l8.5 15H3.5z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function BlockIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.5l11 11" />
    </svg>
  );
}

export function GaugeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 16.5a8.5 8.5 0 1116 0" />
      <path d="M12 16.5l4-5" />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function AppsIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </svg>
  );
}

export function HistoryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.8 12a8.2 8.2 0 103-6.3" />
      <path d="M3.5 4.2V9h4.8" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

/* ---- Protected resource icons (replace emoji in product surfaces) ---- */
export function LocationIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 005.5 10.8C5.5 15.6 12 21 12 21z" />
      <circle cx="12" cy="10.6" r="2.4" />
    </svg>
  );
}
export function ContactsIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9.5" cy="9" r="3.2" />
      <path d="M3.8 19.2c0-3 2.6-5 5.7-5s5.7 2 5.7 5" />
      <path d="M16.5 7.2a3 3 0 010 5.6M18.4 19.2c0-2-.6-3.4-1.6-4.3" />
    </svg>
  );
}
export function CameraIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8.8h3.1l1.5-2.4h7.8l1.5 2.4h3.1v9.4H3.5z" />
      <circle cx="12" cy="13.3" r="3.3" />
    </svg>
  );
}
export function MicIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="9.4" y="3" width="5.2" height="10.4" rx="2.6" />
      <path d="M6 11.6a6 6 0 0012 0" />
      <path d="M12 17.6V21" />
    </svg>
  );
}
export function FilesIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 6.6A1.6 1.6 0 016.1 5h3.5l1.8 2.3h6.5a1.6 1.6 0 011.6 1.6v8.5a1.6 1.6 0 01-1.6 1.6H6.1a1.6 1.6 0 01-1.6-1.6z" />
    </svg>
  );
}
export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.4" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}
export function RefreshIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 11.4a8 8 0 10-1.9 6.1" />
      <path d="M20 4.6v5.2h-5.2" />
    </svg>
  );
}
export function CycleIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.6 10.4a7.5 7.5 0 0112.6-3.3L20 9.8" />
      <path d="M19.4 13.6a7.5 7.5 0 01-12.6 3.3L4 14.2" />
      <path d="M20 5v4.8h-4.8M4 19v-4.8h4.8" />
    </svg>
  );
}
export function WaveIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 14c2.4 0 2.4-4.6 4.8-4.6S10.2 14 12.6 14 15 9.4 17.4 9.4 19.8 14 22.2 14" />
    </svg>
  );
}
export function DormantIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="7.6" strokeDasharray="3 3.4" />
    </svg>
  );
}

/** Resource name -> icon component. */
export const RESOURCE_ICON = {
  location: LocationIcon,
  contacts: ContactsIcon,
  camera: CameraIcon,
  microphone: MicIcon,
  files: FilesIcon,
};
