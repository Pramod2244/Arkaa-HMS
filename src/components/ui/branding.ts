// Utility for applying tenant branding (logo, color)
export function applyTenantBranding(tenant?: { logoUrl?: string; primaryColor?: string }) {
  if (tenant?.primaryColor) {
    document.documentElement.style.setProperty('--primary', tenant.primaryColor);
  } else {
    document.documentElement.style.setProperty('--primary', '#2563eb');
  }
}
