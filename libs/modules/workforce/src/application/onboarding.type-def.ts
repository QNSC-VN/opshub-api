import { Injectable, OnModuleInit } from '@nestjs/common';
import { type DbExecutor, RequestRegistry, RequestTypeDef } from '@platform';

export interface OnboardingPayload extends Record<string, unknown> {
  /** The employee being onboarded. */
  employeeId: string;
  employeeEmail: string;
  /** Requested start date (YYYY-MM-DD). */
  startDate: string;
  department?: string;
  jobTitle?: string;
}

/**
 * Three-step onboarding workflow:
 *   Step 1 — Manager approves the hire          (onboarding.approve)
 *   Step 2 — IT provisions access + equipment   (onboarding.provision)
 *   Step 3 — HR marks onboarding complete       (onboarding.complete)
 *
 * The engine handles all state transitions. `onApprove` is intentionally a
 * no-op because the employee is already `active` — all domain work (RBAC,
 * provisioning) happens out-of-band; the audit event is recorded by the
 * controller after `engine.submit` returns.
 */
@Injectable()
export class OnboardingTypeDef
  implements RequestTypeDef<OnboardingPayload>, OnModuleInit
{
  readonly type = 'onboarding';
  /** Fallback for single-step compatibility; not used in multi-step mode. */
  readonly requiredApprovalPermission = 'onboarding.complete';
  readonly allowSelfApproval = false;
  readonly defaultExpiryHours = 168; // 7 days
  readonly slaHours = 72; // 3 business days end-to-end

  readonly approvalSteps = [
    { step: 1, requiredPermission: 'onboarding.approve' },
    { step: 2, requiredPermission: 'onboarding.provision' },
    { step: 3, requiredPermission: 'onboarding.complete' },
  ];

  constructor(private readonly registry: RequestRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onApprove(_payload: OnboardingPayload, _requestId: string, _approverId: string, _tx: DbExecutor): Promise<void> {
    // No domain side-effects needed on final approval.
    // The controller records the audit event after the engine call returns.
  }
}
