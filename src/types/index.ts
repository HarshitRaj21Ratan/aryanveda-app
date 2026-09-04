export enum UserRole {
  ADMIN = 'admin',
  FINANCE = 'finance',
  DISPATCH = 'dispatch',
  NSM = 'nsm',
  SUPER_STOCKIST = 'super_stockist',
  RSM = 'rsm',
  DISTRIBUTOR = 'distributor',
  ASM = 'asm',
  SO = 'so',
  ASE = 'ase',
  RETAILER = 'retailer',
}

export enum RoleBranch {
  ROOT = 'root',
  SALES_FORCE = 'sales_force',
  SUPPLY_CHAIN = 'supply_chain',
}

export interface IUser {
  _id: string;
  entityId: string;
  name: string;
  state?: string;
  beat?: string;
  email: string;
  role: UserRole;
  branch: RoleBranch;
  parentId: string | null;
  salesAgentId?: string | null;
  retailerType?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  isActive: boolean;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  pagination?: PaginationMeta;
}

export interface IAnnouncementImage {
  url: string;
  publicId: string;
}

export interface IAnnouncement {
  _id: string;
  announcementId: string;
  title: string;
  description: string;
  images: IAnnouncementImage[];
  browserLinks: string[];
  videoLinks: string[];
  createdByEntityId: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export enum NotificationType {
  ORDER_CREATED    = 'order_created',
  ORDER_APPROVED   = 'order_approved',
  ORDER_DISPATCHED = 'order_dispatched',
  ORDER_DELIVERED  = 'order_delivered',
  ORDER_CANCELLED  = 'order_cancelled',
  USER_DEACTIVATED = 'user_deactivated',
  USER_ACTIVATED   = 'user_activated',
  SKU_ADDED        = 'sku_added',
  RETAILER_SO_AUTHORIZATION = 'RETAILER_SO_AUTHORIZATION',
}

export interface INotification {
  _id: string;
  notificationId: string;
  recipientEntityId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceOrderId: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum OrderType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  PRIMARY_HANDOVER = 'primary_handover',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  IN_FINANCE = 'IN_FINANCE',
  APPROVED = 'APPROVED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface IOrderItem {
  skuId: string;
  name?: string;
  quantity: number;
  price: number;
  unitMode?: 'dozen' | 'piece' | 'jar' | 'box';
  orderedQuantity?: number;
  inputAmount?: number;
  boxPriceSnapshot?: number;
  unitPriceSnapshot?: number;
  calculatedQuantity?: number;
  consumedAmount?: number;
  remainderAmount?: number;
  totalAmount?: number;
}

export interface IOrder {
  _id: string;
  orderId: string;
  type: OrderType;
  fromEntityId: string;
  fromEntityName?: string;
  toEntityId: string;
  toEntityName?: string;
  items: IOrderItem[];
  status: OrderStatus;
  approvedBy?: string;
  approvedByName?: string;
  rejectionReason?: string;
  isEmergencyOrder?: boolean;
  idempotencyKey: string;
  createdBy: string;
  createdByRole?: UserRole;
  createdByName?: string;
  onBehalfOf?: string;
  onBehalfOfRole?: UserRole;
  onBehalfOfName?: string;
  onBehalfOfEntityId?: string;
  totalAmount: number;
  totalInputAmount?: number;
  totalConsumedAmount?: number;
  totalRemainder?: number;
  orderActivity?: 'in_store' | 'out_store';
  soLatitude?: number;
  soLongitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ISku {
  _id: string;
  skuId: string;
  name: string;
  description: string;
  price: number;
  displayRequired: number;
  schemeEligible: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  principal?: string;
  category?: string;
  weight?: string;
  boxPrice?: number;
  unitPrice?: number;
  masterSkuId?: string;
  mrpPerUnit?: number;
  masterPackQty?: number;
  masterPackUnit?: string;
  pricePerDozenSS?: number;
  pricePerDozenDist?: number;
  pricePerDozenRetail?: number;
  schemePercent?: number;
  displayRequiredQty?: number;
  perPcPrice?: number;
  offerRateNew?: number;
  boxQty?: number;
  boxRate?: number;
  schemeAmount?: number;
  billing?: number;
  tax18?: number;
  tax5?: number;
  superTotal?: number;
  ssMargin?: number;
  distributorTotal?: number;
  distPerBox?: number;
  retailPerBox?: number;
  retailTotal?: number;
  retailPerPiece?: number;
}

