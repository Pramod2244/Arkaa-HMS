"use client";

import { useState, useCallback, useMemo } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { DrawerFormLayout } from "@/components/forms/DrawerFormLayout";
import { ImportExportToolbar } from "@/components/ui/ImportExportToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Search, CheckSquare, Square } from "lucide-react";
import { useApi, ApiError, apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type Permission = { id: string; code: string; name: string; module: string | null };
type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { permission: Permission }[];
  _count: { userRoles: number };
};

interface RoleFormData {
  code: string;
  name: string;
  description: string;
  permissionIds: string[];
}

export function RolesTable({
  initialRoles,
  permissions,
}: {
  initialRoles: Role[];
  permissions: Permission[];
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  // Form state
  const [formData, setFormData] = useState<RoleFormData>({
    code: "",
    name: "",
    description: "",
    permissionIds: [],
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const { apiCall } = useApi();
  const { addToast } = useToast();

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      const module = p.module || "Other";
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(p);
    });
    return grouped;
  }, [permissions]);

  // Filtered permissions based on search
  const filteredPermissionsByModule = useMemo(() => {
    if (!permissionSearch.trim()) return permissionsByModule;
    
    const search = permissionSearch.toLowerCase();
    const filtered: Record<string, Permission[]> = {};
    
    Object.entries(permissionsByModule).forEach(([module, perms]) => {
      const matchingPerms = perms.filter(
        p => p.code.toLowerCase().includes(search) || 
             p.name.toLowerCase().includes(search) ||
             module.toLowerCase().includes(search)
      );
      if (matchingPerms.length > 0) {
        filtered[module] = matchingPerms;
      }
    });
    
    return filtered;
  }, [permissionsByModule, permissionSearch]);

  // Module display order (sorted alphabetically)
  const sortedModules = useMemo(() => {
    return Object.keys(filteredPermissionsByModule).sort();
  }, [filteredPermissionsByModule]);

  // Toggle module expansion
  const toggleModule = (module: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  // Expand all modules
  const expandAllModules = () => {
    const allExpanded: Record<string, boolean> = {};
    sortedModules.forEach(m => { allExpanded[m] = true; });
    setExpandedModules(allExpanded);
  };

  // Collapse all modules
  const collapseAllModules = () => {
    setExpandedModules({});
  };

  // Check if all permissions in a module are selected
  const isModuleFullySelected = (module: string) => {
    const modulePerms = filteredPermissionsByModule[module] || [];
    return modulePerms.every(p => formData.permissionIds.includes(p.id));
  };

  // Check if some permissions in a module are selected
  const isModulePartiallySelected = (module: string) => {
    const modulePerms = filteredPermissionsByModule[module] || [];
    const selectedCount = modulePerms.filter(p => formData.permissionIds.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < modulePerms.length;
  };

  // Toggle all permissions in a module
  const toggleModulePermissions = (module: string) => {
    const modulePerms = filteredPermissionsByModule[module] || [];
    const modulePermIds = modulePerms.map(p => p.id);
    
    if (isModuleFullySelected(module)) {
      // Deselect all in this module
      setFormData(prev => ({
        ...prev,
        permissionIds: prev.permissionIds.filter(id => !modulePermIds.includes(id))
      }));
    } else {
      // Select all in this module
      setFormData(prev => ({
        ...prev,
        permissionIds: [...new Set([...prev.permissionIds, ...modulePermIds])]
      }));
    }
  };

  // Select all / Deselect all
  const selectAllPermissions = () => {
    const allIds = permissions.map(p => p.id);
    setFormData(prev => ({ ...prev, permissionIds: allIds }));
  };

  const deselectAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissionIds: [] }));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Failed to refresh roles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      permissionIds: [],
    });
    setFormError("");
    setEditingRole(null);
    setPermissionSearch("");
    setExpandedModules({});
  };

  const openCreateDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (role: Role) => {
    const selectedPermIds = role.rolePermissions.map(rp => rp.permission.id);
    
    // Expand modules that have selected permissions
    const modulesToExpand: Record<string, boolean> = {};
    Object.entries(permissionsByModule).forEach(([module, perms]) => {
      const hasSelectedInModule = perms.some(p => selectedPermIds.includes(p.id));
      if (hasSelectedInModule) {
        modulesToExpand[module] = true;
      }
    });
    
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || "",
      permissionIds: selectedPermIds,
    });
    setEditingRole(role);
    setExpandedModules(modulesToExpand);
    setPermissionSearch("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const handleFormSubmit = async () => {
    setFormError("");
    const { code, name, permissionIds } = formData;

    const c = code.trim().toUpperCase();
    const n = name.trim();

    if (!c || !n) {
      setFormError("Role code and name are required.");
      return;
    }

    if (!/^[A-Z_]+$/.test(c)) {
      setFormError("Role code must contain only uppercase letters and underscores.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        code: c,
        name: n,
        description: formData.description.trim() || undefined,
        permissionIds,
      };

      if (editingRole) {
        // Update existing role
        await apiCall(
          () => apiClient.put(`/api/admin/roles/${editingRole.id}`, payload),
          {
            successMessage: "Role updated successfully",
            showErrorToast: false, // Handle errors manually for form validation
          }
        );
      } else {
        // Create new role
        await apiCall(
          () => apiClient.post("/api/admin/roles", payload),
          {
            successMessage: "Role created successfully",
            showErrorToast: false, // Handle errors manually for form validation
          }
        );
      }

      await refresh();
      closeDrawer();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 403) {
          addToast('error', error.message);
        } else if (error.statusCode === 400) {
          setFormError(error.message);
        } else {
          addToast('error', error.message);
        }
      } else {
        addToast('error', 'Something went wrong. Please try again.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      addToast('warning', 'Cannot delete system roles');
      return;
    }

    if (!confirm(`Delete role "${role.name}"?`)) return;

    try {
      await apiCall(
        () => apiClient.delete(`/api/admin/roles/${role.id}`),
        {
          successMessage: 'Role deleted successfully',
        }
      );
      await refresh();
    } catch (error) {
      // Error is already handled by apiCall
    }
  };

  const handleBulkDelete = async () => {
    const nonSystemRoles = selectedRoles.filter(role => !role.isSystem);
    if (nonSystemRoles.length === 0) {
      addToast('warning', 'Cannot delete system roles');
      return;
    }

    if (!confirm(`Delete ${nonSystemRoles.length} selected roles?`)) return;

    try {
      await Promise.all(
        nonSystemRoles.map(role =>
          apiCall(
            () => apiClient.delete(`/api/admin/roles/${role.id}`),
            { showErrorToast: false } // Handle bulk errors differently
          )
        )
      );
      addToast('success', `${nonSystemRoles.length} roles deleted successfully`);
      await refresh();
      setSelectedRoles([]);
    } catch (error) {
      addToast('error', 'Some roles could not be deleted');
    }
  };

  const handleExport = async (format: 'csv' | 'excel', selectedOnly = false) => {
    const exportData = selectedOnly ? selectedRoles : roles;
    // TODO: Implement actual export logic
    console.log(`Exporting ${exportData.length} roles as ${format}`);
  };

  const handleImport = async (file: File) => {
    // TODO: Implement actual import logic
    console.log("Importing file:", file.name);
  };

  const columns: Column<Role>[] = [
    {
      key: "code",
      header: "Code",
      sortable: true,
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
    },
    {
      key: "isSystem",
      header: "Type",
      render: (value: boolean) => (
        <Badge variant={value ? "secondary" : "default"}>
          {value ? "System" : "Tenant"}
        </Badge>
      ),
    },
    {
      key: "_count.userRoles",
      header: "Users",
      render: (value: number) => (value ?? 0).toString(),
    },
    {
      key: "rolePermissions",
      header: "Permissions",
      render: (value: Role['rolePermissions']) => value.length.toString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles</h2>
          <p className="text-sm text-slate-600">Manage roles and their permissions</p>
        </div>
        <div className="flex items-center space-x-3">
          <ImportExportToolbar
            onImport={handleImport}
            onExport={handleExport}
          />
          <Button onClick={openCreateDrawer}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={roles}
        columns={columns}
        loading={loading}
        emptyMessage="No roles found"
        onRowSelect={setSelectedRoles}
        onEdit={openEditDrawer}
        onDelete={handleDelete}
        onExport={handleExport}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalRecords: roles.length,
          pageSize: 20,
          onPageChange: () => {},
          onPageSizeChange: () => {},
        }}
      />

      {/* Role Form Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={editingRole ? "Edit Role" : "Create Role"}
      >
        <DrawerFormLayout
          title={editingRole ? "Edit Role Details" : "Create New Role"}
          onSave={handleFormSubmit}
          onCancel={closeDrawer}
          saveLabel={editingRole ? "Update" : "Create"}
          loading={formLoading}
          disabled={formLoading}
        >
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-900">Basic Information</h4>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="code">Role Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., ADMIN, DOCTOR, NURSE"
                  disabled={formLoading || !!editingRole}
                  className="uppercase"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use uppercase letters and underscores only
                </p>
              </div>

              <div>
                <Label htmlFor="name">Role Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Administrator, Doctor, Nurse"
                  disabled={formLoading}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description of the role"
                  disabled={formLoading}
                />
              </div>
            </div>
          </div>

          {/* Permissions - Module Based UI */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-900">Permissions</h4>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={selectAllPermissions}
                  disabled={formLoading}
                >
                  Select All
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={deselectAllPermissions}
                  disabled={formLoading}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Permission Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                placeholder="Search permissions..."
                className="pl-9"
                disabled={formLoading}
              />
            </div>

            {/* Expand/Collapse Controls */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={expandAllModules}
                className="hover:text-blue-600 underline"
                disabled={formLoading}
              >
                Expand All
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={collapseAllModules}
                className="hover:text-blue-600 underline"
                disabled={formLoading}
              >
                Collapse All
              </button>
              <span className="ml-auto">
                {formData.permissionIds.length} of {permissions.length} selected
              </span>
            </div>

            {/* Module-Based Permission List */}
            <div className="border border-slate-200 rounded-md max-h-[400px] overflow-y-auto">
              {sortedModules.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No permissions found matching "{permissionSearch}"
                </div>
              ) : (
                sortedModules.map((module) => {
                  const modulePerms = filteredPermissionsByModule[module];
                  const isExpanded = expandedModules[module] ?? false;
                  const fullySelected = isModuleFullySelected(module);
                  const partiallySelected = isModulePartiallySelected(module);
                  const selectedCount = modulePerms.filter(p => formData.permissionIds.includes(p.id)).length;

                  return (
                    <div key={module} className="border-b last:border-b-0">
                      {/* Module Header */}
                      <div 
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                        onClick={() => toggleModule(module)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        
                        {/* Module Checkbox */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={fullySelected}
                            ref={(ref) => {
                              if (ref) {
                                (ref as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = partiallySelected && !fullySelected;
                              }
                            }}
                            onCheckedChange={() => toggleModulePermissions(module)}
                            disabled={formLoading}
                          />
                        </div>
                        
                        <span className="font-medium text-sm text-slate-700 flex-1">{module}</span>
                        
                        <Badge variant="secondary" className="text-xs">
                          {selectedCount}/{modulePerms.length}
                        </Badge>
                      </div>

                      {/* Module Permissions (Collapsible) */}
                      {isExpanded && (
                        <div className="px-3 py-2 space-y-1 bg-white">
                          {modulePerms.map((permission) => (
                            <label 
                              key={permission.id} 
                              className="flex items-center gap-3 px-6 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
                            >
                              <Checkbox
                                checked={formData.permissionIds.includes(permission.id)}
                                onCheckedChange={(checked) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    permissionIds: checked
                                      ? [...prev.permissionIds, permission.id]
                                      : prev.permissionIds.filter(id => id !== permission.id)
                                  }));
                                }}
                                disabled={formLoading}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-slate-900">{permission.name}</span>
                                <span className="text-xs text-slate-400 ml-2 font-mono">
                                  ({permission.code})
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
        </DrawerFormLayout>
      </Drawer>
    </div>
  );
}