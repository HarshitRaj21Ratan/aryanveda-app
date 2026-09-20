import { OrderStatus, OrderType, type IOrder, UserRole } from '@/types';

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  [OrderStatus.CREATED]: { label: 'Created', bg: 'bg-blue-50 border border-blue-100', text: 'text-blue-700' },
  [OrderStatus.IN_FINANCE]: { label: 'In Finance', bg: 'bg-indigo-50 border border-indigo-100', text: 'text-indigo-700' },
  [OrderStatus.APPROVED]: { label: 'Approved', bg: 'bg-green-50 border border-green-100', text: 'text-green-700' },
  [OrderStatus.DISPATCHED]: { label: 'Dispatched', bg: 'bg-blue-50 border border-blue-100', text: 'text-blue-700' },
  [OrderStatus.DELIVERED]: { label: 'Delivered', bg: 'bg-emerald-50 border border-emerald-100', text: 'text-emerald-800' },
  [OrderStatus.CANCELLED]: { label: 'Cancelled', bg: 'bg-red-50 border border-red-100', text: 'text-red-700' },
};

export function formatCurrency(val: number): string {
  if (val == null || isNaN(val)) return '₹0.00';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function participantLabel(
  order: IOrder,
  side: 'from' | 'to',
  currentEntityId?: string,
  currentUserName?: string
): string {
  const entityId = side === 'from' ? order.fromEntityId : order.toEntityId;
  const entityName = side === 'from' ? order.fromEntityName : order.toEntityName;

  const isStockIn = order.type === OrderType.PRIMARY && order.fromEntityId === order.toEntityId;
  if (isStockIn) {
    if (entityName) return entityName;
    return side === 'from' ? 'Admin Desk' : currentUserName || 'Requesting Super Stockist';
  }

  if (currentEntityId && entityId === currentEntityId) {
    return currentUserName || entityName || 'You';
  }

  if (entityName) return entityName;

  if (order.type === OrderType.PRIMARY) {
    if (order.fromEntityId === order.toEntityId) {
      return side === 'from' ? 'Source' : 'Destination';
    }
    return side === 'from' ? 'Supplier' : 'Buyer';
  }

  return side === 'from' ? 'Supplier' : 'Retailer';
}

export function isSalesManagerRole(userRole?: UserRole | string | null): boolean {
  if (!userRole) return false;
  const roleStr = String(userRole).toLowerCase();
  return roleStr === 'rsm' || roleStr === 'asm' || roleStr === 'nsm' || userRole === UserRole.RSM || userRole === UserRole.ASM || userRole === UserRole.NSM;
}

export function canDispatchOrder(order: IOrder, userRole?: string, entityId?: string, soTargetRole?: string): boolean {
  const roleStr = (userRole || '').toLowerCase();
  const isDispatch = roleStr === 'dispatch' || userRole === UserRole.DISPATCH;
  const isManager = isSalesManagerRole(userRole);
  const isSO = roleStr === 'so' || roleStr === 'ase' || userRole === UserRole.SO || userRole === UserRole.ASE;
  const isDist = roleStr === 'distributor' || userRole === UserRole.DISTRIBUTOR;
  const isSS = roleStr === 'super_stockist' || userRole === UserRole.SUPER_STOCKIST;
  const isAdmin = roleStr === 'admin' || userRole === UserRole.ADMIN;

  const typeLower = order.type?.toLowerCase();
  const statusLower = order.status?.toLowerCase();
  const primaryLower = OrderType.PRIMARY.toLowerCase();
  const primaryHandoverLower = OrderType.PRIMARY_HANDOVER.toLowerCase();
  const secondaryLower = OrderType.SECONDARY.toLowerCase();
  const createdLower = OrderStatus.CREATED.toLowerCase();
  const approvedLower = OrderStatus.APPROVED.toLowerCase();

  const isStockIn = (typeLower === primaryLower || typeLower === primaryHandoverLower) && order.fromEntityId === order.toEntityId;

  // Stock-in / Primary Handover orders: only Dispatch team or Admin can dispatch
  if (isStockIn) {
    return (isDispatch || isAdmin) && statusLower === approvedLower;
  }

  // RSM/ASM in Super Stockist context: view and cancel only
  if (isManager && soTargetRole === 'SUPER_STOCKIST') {
    return false;
  }

  // Primary orders
  if (
    (typeLower === primaryLower || typeLower === primaryHandoverLower) &&
    (statusLower === approvedLower || statusLower === createdLower) &&
    (order.fromEntityId === entityId || isSS || isAdmin || (isSO && soTargetRole === 'DISTRIBUTOR'))
  ) {
    return true;
  }

  // Secondary orders: allowed for SO, ASE, ASM, RSM, Dist, SS when status is CREATED or APPROVED
  if (
    typeLower === secondaryLower &&
    (statusLower === createdLower || statusLower === approvedLower) &&
    (isSO || isManager || isDist || isSS || isAdmin || order.fromEntityId === entityId)
  ) {
    return true;
  }

  return false;
}

export function canDeliverOrder(order: IOrder, userRole?: string, entityId?: string, soTargetRole?: string): boolean {
  const roleStr = (userRole || '').toLowerCase();
  const isSO = roleStr === 'so' || roleStr === 'ase' || userRole === UserRole.SO || userRole === UserRole.ASE;
  const isManager = isSalesManagerRole(userRole);
  const isAdmin = roleStr === 'admin' || userRole === UserRole.ADMIN;

  const typeLower = order.type?.toLowerCase();
  const statusLower = order.status?.toLowerCase();
  const dispatchedLower = OrderStatus.DISPATCHED.toLowerCase();
  const secondaryLower = OrderType.SECONDARY.toLowerCase();

  // Deliver button ONLY appears when status is DISPATCHED
  if (statusLower !== dispatchedLower) return false;

  // Receiver can confirm delivery
  if (!!entityId && order.toEntityId === entityId) return true;

  // Admin or Sales Management can confirm delivery on behalf of receiver
  if (isAdmin || isManager) return true;

  // Sales Officer can confirm delivery for Secondary orders
  if (isSO && typeLower === secondaryLower) return true;

  return false;
}

export function canCancelOrder(order: IOrder, userRole?: string, entityId?: string): boolean {
  const roleStr = (userRole || '').toLowerCase();
  const isManager = isSalesManagerRole(userRole);
  const isSO = roleStr === 'so' || roleStr === 'ase' || userRole === UserRole.SO || userRole === UserRole.ASE;
  const isAdmin = roleStr === 'admin' || userRole === UserRole.ADMIN;
  const statusLower = order.status?.toLowerCase();
  const createdLower = OrderStatus.CREATED.toLowerCase();

  if (statusLower === createdLower) {
    return (
      order.createdBy === entityId ||
      order.fromEntityId === entityId ||
      order.toEntityId === entityId ||
      isManager ||
      isSO ||
      isAdmin
    );
  }

  return false;
}

export function canApproveOrder(order: IOrder, userRole?: string, entityId?: string): boolean {
  const roleStr = (userRole || '').toLowerCase();
  const isSS = roleStr === 'super_stockist' || userRole === UserRole.SUPER_STOCKIST;
  const isAdmin = roleStr === 'admin' || userRole === UserRole.ADMIN;

  const typeLower = order.type?.toLowerCase();
  const statusLower = order.status?.toLowerCase();
  const primaryLower = OrderType.PRIMARY.toLowerCase();
  const createdLower = OrderStatus.CREATED.toLowerCase();

  return (
    typeLower === primaryLower &&
    statusLower === createdLower &&
    order.fromEntityId !== order.toEntityId &&
    order.createdBy !== entityId &&
    (order.fromEntityId === entityId || isSS || isAdmin)
  );
}

