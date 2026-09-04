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

export function canDispatchOrder(order: IOrder, userRole?: string, entityId?: string, soTargetRole?: string): boolean {
  const isDispatch = userRole === UserRole.DISPATCH;
  const isManager = userRole === UserRole.RSM || userRole === UserRole.ASM;
  const isSO = userRole === UserRole.SO || userRole === UserRole.ASE;
  const isDist = userRole === UserRole.DISTRIBUTOR;

  return (
    (isDispatch && (order.status === OrderStatus.APPROVED || (order.type === OrderType.PRIMARY && order.fromEntityId === order.toEntityId))) ||
    ((order.type?.toLowerCase() === OrderType.PRIMARY.toLowerCase() &&
      order.fromEntityId !== order.toEntityId &&
      (order.status?.toLowerCase() === OrderStatus.APPROVED.toLowerCase() || order.status?.toLowerCase() === OrderStatus.CREATED.toLowerCase()) &&
      (order.fromEntityId === entityId || isManager || (isSO && soTargetRole === 'DISTRIBUTOR'))) ||
      (order.type?.toLowerCase() === OrderType.SECONDARY.toLowerCase() &&
        order.status?.toLowerCase() === OrderStatus.CREATED.toLowerCase() &&
        (order.fromEntityId === entityId || isDist || (isSO && soTargetRole === 'DISTRIBUTOR'))))
  );
}

export function canDeliverOrder(order: IOrder, userRole?: string, entityId?: string): boolean {
  const isSO = userRole === UserRole.SO || userRole === UserRole.ASE;
  return (
    order.status === OrderStatus.DISPATCHED &&
    (order.toEntityId === entityId || (isSO && order.type === OrderType.SECONDARY))
  );
}

export function canCancelOrder(order: IOrder, userRole?: string, entityId?: string): boolean {
  const isManager = userRole === UserRole.RSM || userRole === UserRole.ASM;
  const isSO = userRole === UserRole.SO || userRole === UserRole.ASE;
  return (
    order.status === OrderStatus.CREATED &&
    (order.createdBy === entityId || isManager || isSO)
  );
}
