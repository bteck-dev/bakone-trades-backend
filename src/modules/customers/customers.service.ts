import { supabase } from "../../config/supabase";

export class CustomersService {
  async getAll(search?: string) {
    let query = supabase.from("orders")
      .select("customer_email,customer_name,customer_phone")
      .eq("payment_status", "paid");
    if (search) query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    // Group by email
    const map = new Map<string, any>();
    (data || []).forEach((o: any) => {
      if (!map.has(o.customer_email)) map.set(o.customer_email, { ...o, total_orders: 0, total_spent: 0 });
    });
    const { data: orders } = await supabase.from("orders").select("customer_email,amount,product_name,created_at").eq("payment_status","paid");
    (orders || []).forEach((o: any) => {
      if (map.has(o.customer_email)) {
        map.get(o.customer_email).total_orders++;
        map.get(o.customer_email).total_spent += parseFloat(o.amount);
        map.get(o.customer_email).last_order_date = o.created_at;
      }
    });
    return Array.from(map.values());
  }
  async getOrders(email: string) {
    const { data, error } = await supabase.from("orders").select("*").eq("customer_email", email).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
}
export const customersService = new CustomersService();
