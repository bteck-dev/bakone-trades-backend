import { supabase } from "../../config/supabase";
import { CreateLicenseNoteDto } from "./licenses.model";

// NOTE: We do NOT store license keys in our DB.
// Admin generates keys manually on BotSync then delivers via WhatsApp/Email.
// This module tracks delivery notes and stock status per product.
export class LicensesService {
  async getStockStatus() {
    const { data: products } = await supabase.from("products").select("id,name");
    const { data: orders } = await supabase
      .from("orders")
      .select("product_id,key_status,payment_status")
      .eq("payment_status", "paid");

    return (products || []).map((p: any) => {
      const productOrders = (orders || []).filter((o: any) => o.product_id === p.id);
      return {
        product_id: p.id,
        product_name: p.name,
        pending_delivery: productOrders.filter((o: any) => o.key_status === "pending_delivery").length,
        delivered: productOrders.filter((o: any) => o.key_status === "delivered").length,
        total_paid_orders: productOrders.length,
      };
    });
  }

  async addNote(adminId: string, dto: CreateLicenseNoteDto) {
    const { data: product } = await supabase.from("products").select("name").eq("id", dto.product_id).single();
    const { data, error } = await supabase.from("license_notes").insert({
      product_id: dto.product_id,
      note: dto.note,
      order_id: dto.order_id || null,
      created_by: adminId,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getNotes(productId?: string) {
    let query = supabase.from("license_notes").select("*, products(name)").order("created_at", { ascending: false });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }
}
export const licensesService = new LicensesService();
