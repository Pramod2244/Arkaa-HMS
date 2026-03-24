"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionPayload } from "@/lib/auth";
import { LogOut, User, Settings, ChevronDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TenantNavbar({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const hospitalName = session.tenantName || session.tenantCode || "Hospital";
  const userRole = (session as any).roleName || (session as any).role || "User";

  return (
    <header className="h-16 w-full border-b border-gray-200 bg-white px-6">
      <div className="h-16 flex items-center justify-between">
        {/* LEFT: Logo + Hospital name */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center justify-center">
            <div className="h-9 w-9 rounded-md bg-[#5865F2] flex items-center justify-center text-white font-bold">H</div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-3">
              <h1 className="text-base font-semibold text-slate-900 truncate">{hospitalName}</h1>
            </div>
            <p className="hidden sm:block text-xs text-gray-500">Healthcare Management</p>
          </div>
        </div>

        {/* CENTER: Search */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-xl">
            <div className="mx-auto w-full">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full rounded-lg bg-gray-100 px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Global search"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Status + User */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
            <span className="text-sm text-slate-600">Online</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF]">
                <User className="h-4 w-4 text-[#5865F2]" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-900">{session.fullName}</p>
                <p className="text-xs text-slate-500">{userRole}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-30"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg"
                  >
                    <div className="p-4 border-b border-slate-200">
                      <p className="font-medium text-slate-900">{session.fullName}</p>
                      <p className="text-sm text-slate-600">{session.email}</p>
                      <p className="text-xs text-slate-500 mt-1">{session.tenantName || session.tenantCode}</p>
                    </div>
                    <div className="py-2">
                      <button className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <Settings className="h-4 w-4" />
                        <span>Account Settings</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
