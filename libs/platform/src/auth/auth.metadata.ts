/**
 * Reflector metadata keys shared between the auth decorators and the guards
 * that read them. Kept in a dependency-free module so the guards can import the
 * keys without importing the decorators (which import the guards) — breaking the
 * decorators ⇄ guards circular dependency.
 */
import type { ResourceAttrs } from './authz.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'requiredRoles';
export const PERMISSION_KEY = 'requiredPermission';

/** Resolves the acted-upon resource's attributes from the request, for scoped checks. */
export type ScopeResolver = (req: unknown) => ResourceAttrs | Promise<ResourceAttrs>;

/** Metadata attached by @RequirePermission and read by the PolicyGuard. */
export interface PermissionRequirement {
  permission: string;
  scopeFrom?: ScopeResolver;
}
