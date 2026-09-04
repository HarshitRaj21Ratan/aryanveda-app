import { UserRole } from '@/types';

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

const ROLE_ALIASES: Record<string, UserRole> = {
  financer: UserRole.FINANCE,
  finance_team: UserRole.FINANCE,
  financeuser: UserRole.FINANCE,
  dispatcher: UserRole.DISPATCH,
  dispatch_team: UserRole.DISPATCH,
  dispatchuser: UserRole.DISPATCH,
};

export function normalizeUserRole(role: unknown): UserRole {
  const raw = String(role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (KNOWN_ROLES.has(raw)) {
    return raw as UserRole;
  }
  if (ROLE_ALIASES[raw]) {
    return ROLE_ALIASES[raw];
  }
  if (raw.includes('financ')) {
    return UserRole.FINANCE;
  }
  if (raw.includes('dispatch')) {
    return UserRole.DISPATCH;
  }
  return raw as UserRole;
}

export function isKnownUserRole(role: unknown): role is UserRole {
  return KNOWN_ROLES.has(String(role ?? '').trim().toLowerCase());
}

export function resolveUserRole(role: unknown, entityId?: string): UserRole | null {
  const normalized = normalizeUserRole(role);
  if (isKnownUserRole(normalized)) {
    return normalized;
  }
  if (entityId?.startsWith('FIN-')) {
    return UserRole.FINANCE;
  }
  if (entityId?.startsWith('DSP-')) {
    return UserRole.DISPATCH;
  }
  return null;
}
