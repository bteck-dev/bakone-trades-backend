export const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const KEY_STATUS = {
  PENDING_DELIVERY: "pending_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export const DELIVERY_METHOD = {
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  BOTH: "both",
} as const;

export const AUDIT_ACTIONS = {
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_LOGOUT: "ADMIN_LOGOUT",
  ADMIN_PASSWORD_CHANGED: "ADMIN_PASSWORD_CHANGED",
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_PAID: "ORDER_PAID",
  ORDER_FAILED: "ORDER_FAILED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  KEY_MARKED_DELIVERED: "KEY_MARKED_DELIVERED",
  KEY_DELIVERY_FAILED: "KEY_DELIVERY_FAILED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  PRODUCT_REMOVED: "PRODUCT_REMOVED",
  PRODUCT_VISIBILITY_CHANGED: "PRODUCT_VISIBILITY_CHANGED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type KeyStatus = (typeof KEY_STATUS)[keyof typeof KEY_STATUS];
export type DeliveryMethod = (typeof DELIVERY_METHOD)[keyof typeof DELIVERY_METHOD];
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
