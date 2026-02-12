"use client";

import { motion } from "framer-motion";
import { Stethoscope, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConsultationsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Consultations</h1>
          <p className="mt-2 text-slate-600">Manage patient consultations and clinical notes</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5" />
          New Consultation
        </Button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12">
          <Stethoscope className="h-16 w-16 text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">No Consultations</h2>
          <p className="text-slate-500 text-center max-w-md">
            No consultations recorded yet. Create your first consultation to get started.
          </p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
            Start Consultation
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
