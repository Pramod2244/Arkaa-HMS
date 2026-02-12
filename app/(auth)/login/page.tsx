"use client";

import { motion } from "framer-motion";
import { TenantBranding } from "@/components/auth/TenantBranding";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Background Image with Branding */}
      <div className="hidden lg:flex lg:w-3/5 relative">
        <img
          src="/login-bg.jpg"
          alt="Healthcare background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-blue-900/70"></div>
        <div className="relative z-10 flex items-center justify-center w-full h-full p-8">
          <TenantBranding />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 bg-gray-50">
        <LoginForm />
      </div>

      {/* Mobile Layout - Stack vertically */}
      <div className="lg:hidden absolute inset-0">
        <div className="relative h-1/2">
          <img
            src="/login-bg.jpg"
            alt="Healthcare background"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-blue-900/70"></div>
          <div className="relative z-10 flex items-center justify-center w-full h-full p-8">
            <TenantBranding />
          </div>
        </div>
        <div className="h-1/2 flex items-center justify-center p-8 bg-gray-50">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}