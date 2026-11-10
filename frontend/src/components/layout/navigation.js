export const NAV_GROUPS = [
  {
    id: 'command',
    label: 'Command & Posture',
    items: [
      { id: 'overview', label: 'Overview', subtitle: 'Platform summary & telemetry' },
      { id: 'posture', label: 'Security Posture', subtitle: 'CNAPP-inspired risk view' },
      { id: 'findings', label: 'Security Findings', subtitle: 'Explainable posture findings' },
      { id: 'security', label: 'Runtime Guard & Alerts', subtitle: 'RASP layer & signal register' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence Engines',
    items: [
      { id: 'dna', label: 'Behavioral DNA', subtitle: 'Baseline & drift profiling' },
      { id: 'adaptive', label: 'Adaptive Trust', subtitle: 'Escalation & recovery engine' },
      { id: 'trust', label: 'Trust Analysis', subtitle: 'Score history & audit trail' },
    ],
  },
  {
    id: 'governance',
    label: 'Governance & Access',
    items: [
      { id: 'applications', label: 'Applications', subtitle: 'Application inventory & status' },
      { id: 'permissions', label: 'Permissions', subtitle: 'Resource access matrix' },
      { id: 'policies', label: 'Policy Management', subtitle: 'Detection rules & thresholds' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations & Audit',
    items: [
      { id: 'monitoring', label: 'Access Monitoring', subtitle: 'Simulated request console' },
      { id: 'recommendations', label: 'Recommendations', subtitle: 'Remediation queue' },
      { id: 'history', label: 'Activity History', subtitle: 'Immutable event ledger' },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
