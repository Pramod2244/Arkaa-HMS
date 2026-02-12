"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { DrawerFormLayout } from "@/components/forms/DrawerFormLayout";
import { ImportExportToolbar } from "@/components/ui/ImportExportToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils/date-utils";

type Role = { id: string; code: string; name: string };
type User = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  mobile: string | null;
  isActive: boolean;
  createdAt: string | Date;
  userRoles: { role: Role }[];
};

interface UserFormData {
  fullName: string;
  email: string;
  username: string;
  mobile: string;
  password: string;
  roleIds: string[];
  isActive: boolean;
}

export function UsersTable({
  initialUsers,
  roles,
}: {
  initialUsers: User[];
  roles: Role[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    email: "",
    username: "",
    mobile: "",
    password: "",
    roleIds: [],
    isActive: true,
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to refresh users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      username: "",
      mobile: "",
      password: "",
      roleIds: [],
      isActive: true,
    });
    setFormError("");
    setEditingUser(null);
  };

  const openCreateDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (user: User) => {
    setFormData({
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      mobile: user.mobile || "",
      password: "",
      roleIds: user.userRoles.map(ur => ur.role.id),
      isActive: user.isActive,
    });
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const handleFormSubmit = async () => {
    setFormError("");
    const { fullName, email, password, roleIds } = formData;

    const fn = fullName.trim();
    const em = email.trim().toLowerCase();
    const un = formData.username.trim().toLowerCase() || em;

    if (!fn || !em) {
      setFormError("Full name and email are required.");
      return;
    }

    if (!editingUser && (!password || password.length < 6)) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        fullName: fn,
        email: em,
        username: un,
        mobile: formData.mobile.trim() || undefined,
        password: editingUser ? undefined : password,
        roleIds,
        isActive: formData.isActive,
      };

      const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to save user");
        setFormLoading(false);
        return;
      }

      await refresh();
      closeDrawer();
    } catch (error) {
      setFormError("Something went wrong");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.fullName}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        await refresh();
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedUsers.length} selected users?`)) return;

    try {
      await Promise.all(
        selectedUsers.map(user =>
          fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
        )
      );
      await refresh();
      setSelectedUsers([]);
    } catch (error) {
      console.error("Failed to delete users:", error);
    }
  };

  const handleExport = async (format: 'csv' | 'excel', selectedOnly = false) => {
    const exportData = selectedOnly ? selectedUsers : users;
    // TODO: Implement actual export logic
    console.log(`Exporting ${exportData.length} users as ${format}`);
  };

  const handleImport = async (file: File) => {
    // TODO: Implement actual import logic
    console.log("Importing file:", file.name);
  };

  const columns: Column<User>[] = [
    {
      key: "fullName",
      header: "Name",
      sortable: true,
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
    },
    {
      key: "userRoles",
      header: "Roles",
      render: (value: User['userRoles']) =>
        value.map(ur => ur.role.name).join(", ") || "—",
    },
    {
      key: "isActive",
      header: "Status",
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (value: string | Date) => formatDate(value),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users</h2>
          <p className="text-sm text-slate-600">Manage staff accounts and permissions</p>
        </div>
        <div className="flex items-center space-x-3">
          <ImportExportToolbar
            onImport={handleImport}
            onExport={handleExport}
          />
          <Button onClick={openCreateDrawer}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        emptyMessage="No users found"
        onRowSelect={setSelectedUsers}
        onEdit={openEditDrawer}
        onDelete={handleDelete}
        onExport={handleExport}
        pagination={{
          currentPage: 1,
          totalPages: 1,
          totalRecords: users.length,
          pageSize: 20,
          onPageChange: () => {},
          onPageSizeChange: () => {},
        }}
      />

      {/* User Form Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={editingUser ? "Edit User" : "Create User"}
      >
        <DrawerFormLayout
          title={editingUser ? "Edit User Details" : "Create New User"}
          onSave={handleFormSubmit}
          onCancel={closeDrawer}
          saveLabel={editingUser ? "Update" : "Create"}
          loading={formLoading}
          disabled={formLoading}
        >
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-900">Basic Information</h4>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter full name"
                  disabled={formLoading}
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  disabled={formLoading}
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Leave empty to use email"
                  disabled={formLoading}
                />
              </div>

              <div>
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={formData.mobile}
                  onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                  placeholder="Enter mobile number"
                  disabled={formLoading}
                />
              </div>

              {!editingUser && (
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password (min 6 characters)"
                    disabled={formLoading}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-900">Roles & Permissions</h4>

            <div className="space-y-3">
              <Label>Assign Roles</Label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-md p-3">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-3 cursor-pointer">
                    <Checkbox
                      checked={formData.roleIds.includes(role.id)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          roleIds: checked
                            ? [...prev.roleIds, role.id]
                            : prev.roleIds.filter(id => id !== role.id)
                        }));
                      }}
                      disabled={formLoading}
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-900">{role.name}</span>
                      <span className="text-xs text-slate-500 ml-2">({role.code})</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-900">Account Status</h4>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, isActive: checked as boolean }))
                }
                disabled={formLoading}
              />
              <Label htmlFor="isActive" className="text-sm">
                Account is active
              </Label>
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
