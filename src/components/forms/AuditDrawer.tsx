"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface AuditLog {
  id: string;
  performedAt: string;
  performedBy: string;
  action: string;
  oldValue?: any;
  newValue?: any;
}

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
}

export function AuditDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
}: AuditDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, entityType, entityId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/audit?entityType=${entityType}&entityId=${entityId}`
      );
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any) => {
    if (!value) return "N/A";
    return JSON.stringify(value, null, 2);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "text-green-600 bg-green-100";
      case "UPDATE":
        return "text-blue-600 bg-blue-100";
      case "DELETE":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Audit History - {entityType}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No audit logs found
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(log.performedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Performed by: {log.performedBy}
                      </p>
                      {log.oldValue && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-1">
                            Old Value:
                          </h4>
                          <pre className="text-xs bg-red-50 p-2 rounded border text-red-800 overflow-x-auto">
                            {formatValue(log.oldValue)}
                          </pre>
                        </div>
                      )}
                      {log.newValue && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">
                            New Value:
                          </h4>
                          <pre className="text-xs bg-green-50 p-2 rounded border text-green-800 overflow-x-auto">
                            {formatValue(log.newValue)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}