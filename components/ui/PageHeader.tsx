"use client";

import React from "react";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  preTitle?: React.ReactNode; // e.g. breadcrumb
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, preTitle, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-[#F5F7FB]">
      <div className="p-6 border-b border-slate-200">
        {preTitle}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 bg-blue-100 rounded-lg">{icon}</div>}
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export default PageHeader;
