import React from 'react';

export function TenantLogo({ logoUrl, name, size = 36 }: { logoUrl?: string; name?: string; size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || 'Tenant Logo'}
        className="rounded-lg bg-white/80 object-contain"
        style={{ width: size, height: size, boxShadow: '0 2px 8px 0 rgba(16,30,54,0.08)' }}
      />
    );
  }
  // Fallback system logo (SVG)
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-white/80"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="8" fill="#2563eb" />
        <path d="M10 18h16M18 10v16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
