"use client";

import { useState } from "react";
import type { SessionPayload } from "@/lib/auth";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { TenantNavbar } from "@/components/tenant-navbar";
import { PageTransition } from "@/components/ui/PageTransition";

export function TenantLayoutShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <TenantSidebar session={session} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out">
        <TenantNavbar session={session} />
        <main className="flex-1 p-5 md:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
