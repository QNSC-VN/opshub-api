/**
 * In-app notification template registry.
 * Each template maps a type key → (vars) → { title, body }.
 */

// ── Template names ────────────────────────────────────────────────────────────

export type NotificationTemplateName =
  | 'access_request.submitted'
  | 'access_request.approved'
  | 'access_request.denied'
  | 'asset.assigned'
  | 'asset.unassigned'
  | 'employee.offboarded';

// ── Per-template variable shapes ─────────────────────────────────────────────

export interface NotificationTemplateVars {
  'access_request.submitted': {
    resourceName: string;
    requesterName: string;
  };
  'access_request.approved': {
    resourceName: string;
    approverName: string;
  };
  'access_request.denied': {
    resourceName: string;
    approverName: string;
    reason?: string;
  };
  'asset.assigned': {
    assetName: string;
    assetTag:  string;
  };
  'asset.unassigned': {
    assetName: string;
    assetTag:  string;
  };
  'employee.offboarded': {
    employeeName: string;
  };
}

export interface RenderedNotification {
  title: string;
  body:  string;
}

// ── Template implementations ──────────────────────────────────────────────────

const templates: {
  [K in NotificationTemplateName]: (v: NotificationTemplateVars[K]) => RenderedNotification;
} = {
  'access_request.submitted'(v) {
    return {
      title: 'Access request submitted',
      body:  `Your request for access to "${v.resourceName}" is pending approval.`,
    };
  },
  'access_request.approved'(v) {
    return {
      title: 'Access request approved ✓',
      body:  `${v.approverName} approved your request for "${v.resourceName}".`,
    };
  },
  'access_request.denied'(v) {
    const extra = v.reason ? ` Reason: ${v.reason}` : '';
    return {
      title: 'Access request denied',
      body:  `${v.approverName} denied your request for "${v.resourceName}".${extra}`,
    };
  },
  'asset.assigned'(v) {
    return {
      title: 'Asset assigned to you',
      body:  `${v.assetName} (${v.assetTag}) has been assigned to you.`,
    };
  },
  'asset.unassigned'(v) {
    return {
      title: 'Asset unassigned',
      body:  `${v.assetName} (${v.assetTag}) has been unassigned from you.`,
    };
  },
  'employee.offboarded'(v) {
    return {
      title: 'Offboarding complete',
      body:  `The offboarding process for ${v.employeeName} has been completed.`,
    };
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function renderNotification<K extends NotificationTemplateName>(
  type: K,
  vars: NotificationTemplateVars[K],
): RenderedNotification {
  const fn = templates[type];
  return (fn as (v: NotificationTemplateVars[K]) => RenderedNotification)(vars);
}
