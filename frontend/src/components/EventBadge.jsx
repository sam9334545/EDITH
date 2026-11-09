import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Activity,
  Lightbulb,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { ACTIVITY_EVENT_TYPES } from '@shared/contracts.js';

export const EVENT_TYPE_CONFIG = {
  [ACTIVITY_EVENT_TYPES.ACCESS_ALLOWED]: {
    label: 'Access Allowed',
    className: 'badge-allowed',
    icon: ShieldCheck,
  },
  [ACTIVITY_EVENT_TYPES.ACCESS_DENIED]: {
    label: 'Access Denied',
    className: 'badge-denied',
    icon: ShieldAlert,
  },
  [ACTIVITY_EVENT_TYPES.ALERT_CREATED]: {
    label: 'Security Alert',
    className: 'badge-alert',
    icon: AlertTriangle,
  },
  [ACTIVITY_EVENT_TYPES.PERMISSION_GRANTED]: {
    label: 'Permission Granted',
    className: 'badge-granted',
    icon: KeyRound,
  },
  [ACTIVITY_EVENT_TYPES.PERMISSION_REVOKED]: {
    label: 'Permission Revoked',
    className: 'badge-revoked',
    icon: KeyRound,
  },
  [ACTIVITY_EVENT_TYPES.APP_SUSPENDED]: {
    label: 'App Suspended',
    className: 'badge-suspended',
    icon: PauseCircle,
  },
  [ACTIVITY_EVENT_TYPES.APP_REACTIVATED]: {
    label: 'App Reactivated',
    className: 'badge-reactivated',
    icon: PlayCircle,
  },
  [ACTIVITY_EVENT_TYPES.TRUST_SCORE_CHANGED]: {
    label: 'Trust Score Changed',
    className: 'badge-trust',
    icon: Activity,
  },
  [ACTIVITY_EVENT_TYPES.RECOMMENDATION_CREATED]: {
    label: 'Recommendation Created',
    className: 'badge-rec-created',
    icon: Lightbulb,
  },
  [ACTIVITY_EVENT_TYPES.RECOMMENDATION_APPLIED]: {
    label: 'Recommendation Applied',
    className: 'badge-rec-applied',
    icon: CheckCircle2,
  },
};

export function EventBadge({ eventType }) {
  const config = EVENT_TYPE_CONFIG[eventType] || {
    label: eventType || 'Unknown Event',
    className: 'badge-generic',
    icon: FileText,
  };

  const Icon = config.icon;

  return (
    <span className={`event-badge ${config.className}`}>
      <Icon size={13} strokeWidth={2.2} />
      <span>{config.label}</span>
    </span>
  );
}

export default EventBadge;
