import { OrderStatus, KeyStatus, DeliveryMethod } from "../../constants";

export interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  product_id: string;
  product_name: string;
  amount: number;
  currency: string;
  payment_status: OrderStatus;
  payfast_payment_id?: string;
  payment_provider?: string;
  payment_method?: string;
  // Manual delivery tracking
  key_status: KeyStatus;
  delivery_method?: DeliveryMethod;
  delivered_by?: string; // admin who delivered
  delivered_at?: string;
  delivery_notes?: string;
  // WhatsApp link for admin to quickly message customer
  whatsapp_link?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderDto {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  product_id: string;
  payment_method?: string;
}

export interface MarkDeliveredDto {
  delivery_method: DeliveryMethod;
  delivery_notes?: string;
}