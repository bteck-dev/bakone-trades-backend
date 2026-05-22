import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../config/supabase";
import { Order, CreateOrderDto, MarkDeliveredDto } from "./orders.model";
import { ORDER_STATUS, KEY_STATUS } from "../../constants";
import { config } from "../../config/env";

export class OrdersService {
  // Build WhatsApp link so admin can message customer with one click
  private buildWhatsAppLink(customerPhone: string, productName: string, orderId: string): string {
    const msg = encodeURIComponent(
      `Hi! Your ${productName} license key is ready. Order ID: ${orderId}. Please find your key below:`
    );
    const phone = customerPhone.replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${msg}`;
  }

  async createPendingOrder(dto: CreateOrderDto): Promise<Order> {
    const orderId = `BT-${uuidv4().split("-")[0].toUpperCase()}`;
    const { data: product } = await supabase
      .from("products").select("name,price").eq("id", dto.product_id).single();
    if (!product) throw new Error("Product not found");

    const whatsappLink = dto.customer_phone
      ? this.buildWhatsAppLink(dto.customer_phone, product.name, orderId)
      : undefined;

    const { data, error } = await supabase.from("orders").insert({
      order_id: orderId,
      customer_name: dto.customer_name,
      customer_email: dto.customer_email,
      customer_phone: dto.customer_phone || null,
      product_id: dto.product_id,
      product_name: product.name,
      amount: product.price,
      currency: "USD",
      payment_status: ORDER_STATUS.PENDING,
      key_status: KEY_STATUS.PENDING_DELIVERY,
      whatsapp_link: whatsappLink || null,
    }).select().single();

    if (error) throw new Error(error.message);
    return data as Order;
  }

  async markAsPaid(orderId: string, payfastPaymentId: string): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: ORDER_STATUS.PAID,
        payfast_payment_id: payfastPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .select().single();
    if (error) throw new Error(error.message);
    return data as Order;
  }

  async markAsCancelled(orderId: string): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: ORDER_STATUS.CANCELLED,
        key_status: KEY_STATUS.CANCELLED,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .neq("payment_status", ORDER_STATUS.PAID)
      .select().single();
    if (error || !data) throw new Error("Order not found or already paid");
    return data as Order;
  }

  async markAsFailed(orderId: string, payfastPaymentId?: string): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: ORDER_STATUS.FAILED,
        payfast_payment_id: payfastPaymentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .neq("payment_status", ORDER_STATUS.PAID)
      .select().single();
    if (error || !data) throw new Error("Order not found or already paid");
    return data as Order;
  }

  async markDelivered(orderId: string, adminId: string, dto: MarkDeliveredDto): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({
        key_status: KEY_STATUS.DELIVERED,
        delivery_method: dto.delivery_method,
        delivered_by: adminId,
        delivered_at: new Date().toISOString(),
        delivery_notes: dto.delivery_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("payment_status", ORDER_STATUS.PAID)
      .select().single();
    if (error || !data) throw new Error("Order not found or not yet paid");
    return data as Order;
  }

  async getAll(filters: {
    search?: string; status?: string; keyStatus?: string; page?: number; limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("orders").select("*", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, to);

    if (filters.status) query = query.eq("payment_status", filters.status);
    if (filters.keyStatus) query = query.eq("key_status", filters.keyStatus);
    if (filters.search) {
      query = query.or(
        `customer_email.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      orders: data as Order[],
      pagination: { total: count || 0, page, limit, pages: Math.ceil((count || 0) / limit) },
    };
  }

  async getByOrderId(orderId: string): Promise<Order> {
    const { data, error } = await supabase.from("orders").select("*").eq("order_id", orderId).single();
    if (error || !data) throw new Error("Order not found");
    return data as Order;
  }

  async getPendingDeliveries(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("payment_status", ORDER_STATUS.PAID)
      .eq("key_status", KEY_STATUS.PENDING_DELIVERY)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Order[];
  }

  async exportCSV(): Promise<string> {
    const { data, error } = await supabase
      .from("orders").select("order_id,customer_name,customer_email,product_name,amount,payment_status,key_status,delivery_method,delivered_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const headers = ["Order ID","Customer","Email","Product","Amount","Payment Status","Key Status","Delivery Method","Delivered At","Date"];
    const rows = (data || []).map((o: any) => [
      o.order_id, o.customer_name, o.customer_email, o.product_name,
      o.amount, o.payment_status, o.key_status, o.delivery_method || "",
      o.delivered_at || "", o.created_at,
    ]);
    return [headers, ...rows].map((r) => r.join(",")).join("\n");
  }
}

export const ordersService = new OrdersService();
