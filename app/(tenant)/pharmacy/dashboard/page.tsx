"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Package,
} from "lucide-react";
import { getPharmacyDashboardData } from "./actions";

interface DashboardData {
  revenueToday: number;
  pendingPOs: number;
  lowStockItems: number;
  nearExpiryBatches: number;
}

export default function PharmacyDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPharmacyDashboardData().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const cards = [
    {
      title: "Today's Revenue",
      value: `₹${data.revenueToday.toLocaleString()}`,
      icon: TrendingUp,
      desc: "Completed sales today",
      gradient: "from-green-500 to-emerald-600",
      bgGradient: "from-green-50 to-emerald-50",
    },
    {
      title: "Pending POs",
      value: data.pendingPOs,
      icon: ShoppingCart,
      desc: "Awaiting delivery",
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50",
    },
    {
      title: "Low Stock Alerts",
      value: data.lowStockItems,
      icon: Package,
      desc: "Items below reorder level",
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50",
      alert: data.lowStockItems > 0,
    },
    {
      title: "Near Expiry",
      value: data.nearExpiryBatches,
      icon: AlertTriangle,
      desc: "Expiring in 30 days",
      gradient: "from-red-500 to-rose-600",
      bgGradient: "from-red-50 to-rose-50",
      alert: data.nearExpiryBatches > 0,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pharmacy Overview</h1>
        <p className="text-gray-500">Real-time metrics and inventory alerts.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, desc, gradient, bgGradient, alert }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={`relative rounded-xl p-6 shadow-sm border ${
              alert ? "border-red-200" : "border-gray-100"
            } bg-gradient-to-br ${bgGradient} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
              <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <button onClick={() => router.push("/pharmacy/op-sales")} className="p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-gray-700 text-sm">
          + New Sale
        </button>
        <button onClick={() => router.push("/pharmacy/grn")} className="p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-gray-700 text-sm">
          + Receive Goods
        </button>
        <button onClick={() => router.push("/pharmacy/inventory/stock")} className="p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-gray-700 text-sm">
          Check Stock
        </button>
        <button onClick={() => router.push("/pharmacy/purchase-orders")} className="p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-gray-700 text-sm">
          Manage Orders
        </button>
      </div>
    </div>
  );
}