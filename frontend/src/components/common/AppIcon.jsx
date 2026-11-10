import {
  Activity,
  AlertTriangle,
  AppWindow,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Mic,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

const NAV_ICON_MAP = {
  overview: LayoutDashboard,
  posture: ShieldCheck,
  findings: Radar,
  policies: SlidersHorizontal,
  dna: Activity,
  adaptive: Gauge,
  applications: AppWindow,
  permissions: KeyRound,
  monitoring: Terminal,
  security: ShieldAlert,
  trust: TrendingUp,
  recommendations: ClipboardCheck,
  history: History,
};

const RESOURCE_ICON_MAP = {
  location: MapPin,
  contacts: Users,
  camera: Camera,
  microphone: Mic,
  files: FileText,
};

export function NavIcon({ id, size = 16, className = '' }) {
  const Component = NAV_ICON_MAP[id] || Shield;
  return <Component size={size} strokeWidth={1.85} className={className} aria-hidden="true" />;
}

export function ResourceIcon({ resource, size = 16, className = '' }) {
  const Component = RESOURCE_ICON_MAP[resource] || FileText;
  return <Component size={size} strokeWidth={1.85} className={className} aria-hidden="true" />;
}

export function SeverityIcon({ severity, size = 16, className = '' }) {
  if (severity === 'critical' || severity === 'high') {
    return <ShieldAlert size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
  }
  if (severity === 'medium') {
    return <AlertTriangle size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
  }
  return <CheckCircle2 size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
}

export function DecisionIcon({ status, size = 15, className = '' }) {
  if (status === 'denied' || status === 'blocked') {
    return <XCircle size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
  }
  return <CheckCircle2 size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
}

export function BrandShieldMark({ className = '' }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 3L5.5 8.2V17.4C5.5 25.1 10.8 31.3 18 33.4C25.2 31.3 30.5 25.1 30.5 17.4V8.2L18 3Z"
        fill="#123D32"
      />
      <path
        d="M18 6.4L8.5 10.4V17.3C8.5 23.3 12.6 28.2 18 30C23.4 28.2 27.5 23.3 27.5 17.3V10.4L18 6.4Z"
        fill="#26745C"
        fillOpacity="0.45"
        stroke="#A8D5C2"
        strokeWidth="1"
      />
      <rect x="13" y="15" width="2.4" height="7" rx="1.2" fill="#E4F2EC" />
      <rect x="16.8" y="11.5" width="2.4" height="12" rx="1.2" fill="#FFFFFF" />
      <rect x="20.6" y="16.5" width="2.4" height="5.5" rx="1.2" fill="#A8D5C2" />
    </svg>
  );
}

export { RefreshCw, Shield, ShieldCheck, ShieldAlert };

