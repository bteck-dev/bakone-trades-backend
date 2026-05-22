import { supabase } from "../../config/supabase";

export class DashboardService {
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { data: allOrders },
      { data: monthOrders },
      { data: recentOrders },
      { data: auditLogs },
      { count: openThreads },
      { count: failedMessages },
    ] = await Promise.all([
      supabase.from("orders").select("amount,payment_status,key_status,product_name,created_at").eq("payment_status","paid"),
      supabase.from("orders").select("amount").eq("payment_status","paid").gte("created_at", startOfMonth),
      supabase.from("orders").select("order_id,customer_name,customer_email,product_name,amount,payment_status,key_status,created_at").order("created_at",{ascending:false}).limit(5),
      supabase.from("audit_logs").select("action,description,created_at").order("created_at",{ascending:false}).limit(10),
      supabase.from("conversation_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("message_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    const totalRevenue = (allOrders||[]).reduce((s:number,o:any)=>s+parseFloat(o.amount),0);
    const monthRevenue = (monthOrders||[]).reduce((s:number,o:any)=>s+parseFloat(o.amount),0);
    const pendingDeliveries = (allOrders||[]).filter((o:any)=>o.key_status==="pending_delivery").length;

    // 7-day revenue chart
    const chart: Record<string,number> = {};
    for(let i=6;i>=0;i--){
      const d = new Date(); d.setDate(d.getDate()-i);
      chart[d.toISOString().split("T")[0]] = 0;
    }
    (allOrders||[]).forEach((o:any)=>{
      const day = o.created_at.split("T")[0];
      if(chart[day]!==undefined) chart[day]+=parseFloat(o.amount);
    });

    return {
      stats: {
        totalRevenue, monthRevenue,
        totalOrders: allOrders?.length||0,
        ordersThisMonth: monthOrders?.length||0,
        pendingDeliveries,
        deliveredKeys: (allOrders||[]).filter((o:any)=>o.key_status==="delivered").length,
        openMessageThreads: openThreads || 0,
        failedMessages: failedMessages || 0,
      },
      revenueChart: Object.entries(chart).map(([date,revenue])=>({date,revenue})),
      recentOrders: recentOrders||[],
      recentActivity: auditLogs||[],
      pendingDeliveryAlert: pendingDeliveries > 0,
    };
  }
}
export const dashboardService = new DashboardService();
