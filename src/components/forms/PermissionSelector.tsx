"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Permission {
  id: string;
  code: string;
  name: string;
  module?: string;
  description?: string;
}

interface PermissionSelectorProps {
  selectedPermissions: string[];
  onChange: (permissionIds: string[]) => void;
}

export function PermissionSelector({
  selectedPermissions,
  onChange,
}: PermissionSelectorProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await fetch("/api/admin/permissions");
      const data = await res.json();
      setPermissions(data);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = permissions.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.module && p.module.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedPermissions = filteredPermissions.reduce(
    (acc, perm) => {
      const module = perm.module || "Other";
      if (!acc[module]) acc[module] = [];
      acc[module].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const handleToggle = (permissionId: string) => {
    const newSelected = selectedPermissions.includes(permissionId)
      ? selectedPermissions.filter((id) => id !== permissionId)
      : [...selectedPermissions, permissionId];
    onChange(newSelected);
  };

  const handleSelectAll = (modulePermissions: Permission[]) => {
    const moduleIds = modulePermissions.map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedPermissions.includes(id));
    const newSelected = allSelected
      ? selectedPermissions.filter((id) => !moduleIds.includes(id))
      : [...new Set([...selectedPermissions, ...moduleIds])];
    onChange(newSelected);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <input
          type="text"
          placeholder="Search permissions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="max-h-96 overflow-y-auto space-y-4">
        {Object.entries(groupedPermissions).map(([module, perms]) => (
          <motion.div
            key={module}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">{module}</h3>
              <button
                type="button"
                onClick={() => handleSelectAll(perms)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {perms.every((p) => selectedPermissions.includes(p.id))
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {perms.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => handleToggle(perm.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{perm.name}</div>
                    <div className="text-sm text-gray-500">{perm.code}</div>
                    {perm.description && (
                      <div className="text-sm text-gray-600 mt-1">
                        {perm.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-sm text-gray-600">
        Selected: {selectedPermissions.length} permissions
      </div>
    </div>
  );
}