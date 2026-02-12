"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  FileCheck,
  CreditCard,
  Stethoscope,
  Activity,
  TrendingUp,
  Clock,
} from "lucide-react";
import { getDashboardData } from "./actions";

interface DashboardData {
  patientCount: number;
  userCount: number;
  departmentCount: number;
  tenantName: string | null;
}

export default function TenantDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setError("Failed to load dashboard data. Please refresh the page.");
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    getDashboardData()
      .then((result) => {
        clearTimeout(timeout);
        if (result) {
          setData(result);
        } else {
          setError("Unable to load dashboard data");
        }
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error("Dashboard error:", err);
        setError("An error occurred loading dashboard data");
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [loading]);

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Active Staff",
      value: data.userCount,
      icon: Users,
      desc: "Healthcare professionals",
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
    },
    {
      title: "Total Patients",
      value: data.patientCount,
      icon: Stethoscope,
      desc: "Registered patients",
      gradient: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-emerald-100",
    },
    {
      title: "Departments",
      value: data.departmentCount,
      icon: Activity,
      desc: "Medical departments",
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
    },
    {
      title: "Today's Appointments",
      value: 0,
      icon: Calendar,
      desc: "Scheduled visits",
      gradient: "from-orange-500 to-orange-600",
      bgGradient: "from-orange-50 to-orange-100",
    },
    {
      title: "Pending Reports",
      value: 0,
      icon: FileCheck,
      desc: "Awaiting review",
      gradient: "from-red-500 to-red-600",
      bgGradient: "from-red-50 to-red-100",
    },
    {
      title: "Revenue Today",
      value: "₹0",
      icon: TrendingUp,
      desc: "Daily collection",
      gradient: "from-green-500 to-green-600",
      bgGradient: "from-green-50 to-green-100",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-8"
    >
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold mb-2"
          >
            Welcome back
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl opacity-90"
          >
            {data.tenantName || "Your Organization"} — Healthcare Management Dashboard
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center space-x-4 text-sm"
          >
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="w-1 h-1 bg-white/50 rounded-full"></div>
            <div>System Status: Operational</div>
          </motion.div>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, value, icon: Icon, desc, gradient, bgGradient }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`relative bg-gradient-to-br ${bgGradient} rounded-xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 group`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300`}></div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-xl p-6 shadow-lg border border-gray-100"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Add Patient", icon: Users },
            { label: "Schedule Appointment", icon: Calendar, action: () => router.push("/appointments?openSchedule=1") },
            { label: "View Reports", icon: FileCheck },
            { label: "Manage Staff", icon: Stethoscope },
          ].map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              onClick={action}
              className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <Icon className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mx-auto mb-2 transition-colors" />
              <span className="text-sm font-medium text-gray-900">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
