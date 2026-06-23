import type {
  accessRequestStatusEnum,
  accessTypeEnum,
} from '../../../../../db/schema';

export type AccessRequestStatus = (typeof accessRequestStatusEnum.enumValues)[number];
export type AccessType = (typeof accessTypeEnum.enumValues)[number];

export interface AccessRequest {
  id: string;
  requesterId: string;
  accessType: AccessType;
  target: string;
  justification: string;
  durationHours: string;
  status: AccessRequestStatus;
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessGrant {
  id: string;
  requestId: string;
  granteeId: string;
  accessType: AccessType;
  target: string;
  grantedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateAccessRequestInput {
  requesterId: string;
  accessType: AccessType;
  target: string;
  justification: string;
  durationHours: number;
}

export interface AccessRequestFilters {
  requesterId?: string;
  status?: AccessRequestStatus;
}
