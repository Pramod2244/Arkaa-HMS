"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  delay?: number;
}

export function FormSection({
  title,
  description,
  children,
  delay = 0,
}: FormSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
    </motion.div>
  );
}