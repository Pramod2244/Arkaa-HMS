"use client";

import { TenantLogo } from "@/components/ui/TenantLogo";

interface TenantBrandingProps {
  tenantName?: string;
  tenantLogo?: string;
  primaryColor?: string;
}

export function TenantBranding({
  tenantName = "HMS Cloud",
  tenantLogo,
  primaryColor = "#3b82f6",
}: TenantBrandingProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <TenantLogo size={64} name={tenantName} />
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">{tenantName}</h1>
        <p className="text-white/80 text-lg">
          Secure, unified hospital operations
        </p>
      </div>
    </div>
  );
}