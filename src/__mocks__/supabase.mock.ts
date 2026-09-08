import { jest } from '@jest/globals';

// Mock data matching real DB structure
export const mockProducts = [
  { id: "prod-1", name: "FX Killer PV4.0 Pro", version: "4.0 Pro", slug: "fx-killer-pv4-pro",
    description: "Analyzes real-time market data using RSI, Bollinger Bands...", price: 30.00,
    features: ["Real-time analysis","Smart entry & exit","Works on 20+ markets"], is_visible: true,
    image_url: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  { id: "prod-2", name: "Poverty Scalper EA", version: "2.0+", slug: "poverty-scalper-ea",
    description: "Trend analysis and smart risk management EA...", price: 21.00,
    features: ["Trend analysis","Price action","Risk management"], is_visible: true,
    image_url: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
];

export const mockOrders = [
  { id: "ord-1", order_id: "BT-ABC123", customer_name: "John Dube", customer_email: "john@example.com",
    customer_phone: "+27821234567", product_id: "prod-1", product_name: "FX Killer PV4.0 Pro",
    amount: 30.00, currency: "ZAR", payment_status: "paid", key_status: "pending_delivery",
    payfast_payment_id: "ikhokha-paylink-123", delivered_by: null, delivered_at: null, delivery_method: null,
    delivery_notes: null, whatsapp_link: "https://wa.me/27821234567?text=Hi...",
    created_at: "2025-06-01T10:00:00Z", updated_at: "2025-06-01T10:00:00Z" },
  { id: "ord-2", order_id: "BT-DEF456", customer_name: "Sarah Mokoena", customer_email: "sarah@example.com",
    customer_phone: "+27831234567", product_id: "prod-2", product_name: "Poverty Scalper EA",
    amount: 21.00, currency: "ZAR", payment_status: "paid", key_status: "delivered",
    payfast_payment_id: "ikhokha-paylink-456", delivered_by: "admin-1", delivered_at: "2025-06-01T12:00:00Z",
    delivery_method: "whatsapp", delivery_notes: "Sent via WhatsApp",
    whatsapp_link: "https://wa.me/27831234567?text=Hi...",
    created_at: "2025-06-01T09:00:00Z", updated_at: "2025-06-01T12:00:00Z" },
];

export const mockAdmin = {
  id: "admin-1", email: "bakonetrades@gmail.com",
  password: "$2a$12$mockhashedpassword", created_at: "2025-01-01T00:00:00Z",
};

export const mockAuditLogs = [
  { id: "log-1", action: "ADMIN_LOGIN", admin_id: "admin-1", entity_type: null, entity_id: null,
    description: "Admin logged in: bakonetrades@gmail.com", metadata: null,
    ip_address: "127.0.0.1", user_agent: "Jest/Test", created_at: "2025-06-01T08:00:00Z" },
  { id: "log-2", action: "ORDER_PAID", admin_id: null, entity_type: "order", entity_id: "BT-ABC123",
    description: "Payment confirmed for order BT-ABC123", metadata: { amount: 30, product: "FX Killer PV4.0 Pro" },
    ip_address: null, user_agent: null, created_at: "2025-06-01T10:00:00Z" },
];

// Supabase mock factory
export const createSupabaseMock = (returnData: any, returnError: any = null) => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data: returnData, error: returnError })),
  then: jest.fn((resolve: any, reject: any) =>
    Promise.resolve({
      data: returnData,
      error: returnError,
      count: returnData?.length || 0,
    }).then(resolve, reject)
  ),
});
