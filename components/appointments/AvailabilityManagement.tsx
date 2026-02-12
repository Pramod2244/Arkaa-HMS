"use client";

/**
 * Doctor Availability Management Component
 * 
 * Weekly grid view for managing doctor availability schedules.
 * Supports create, edit, copy, and delete operations.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api-client";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Clock,
  Users,
  AlertCircle,
} from "lucide-react";

// Types
interface Availability {
  id: string;
  doctorId: string;
  departmentId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  maxPatientsPerDay: number | null;
  allowWalkIn: boolean;
  walkInSlotReservation: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  version: number;
  doctor: {
    id: string;
    doctorCode: string;
    fullName: string;
  };
  department: {
    id: string;
    code: string;
    name: string;
  };
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface AvailabilityFormData {
  departmentId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  maxPatientsPerDay: number | null;
  allowWalkIn: boolean;
  walkInSlotReservation: number;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
}

interface AvailabilityManagementProps {
  doctorId: string;
  doctorName: string;
  departments: Department[];
}

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const initialFormData: AvailabilityFormData = {
  departmentId: "",
  dayOfWeek: "MONDAY",
  startTime: "09:00",
  endTime: "17:00",
  slotDurationMinutes: 15,
  maxPatientsPerSlot: 1,
  maxPatientsPerDay: null,
  allowWalkIn: true,
  walkInSlotReservation: 0,
  effectiveFrom: new Date().toISOString().split("T")[0],
  effectiveTo: "",
  status: "ACTIVE",
};

export default function AvailabilityManagement({
  doctorId,
  doctorName,
  departments,
}: AvailabilityManagementProps) {
  const { addToast } = useToast();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AvailabilityFormData>(initialFormData);
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null);
  const [copySource, setCopySource] = useState<Availability | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Availability | null>(null);

  // Bulk create mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Fetch availabilities
  const fetchAvailabilities = useCallback(async () => {
    try {
      setLoading(true);
      // apiClient.get returns data directly (array of availabilities)
      const response = await apiClient.get(`/api/masters/doctors/${doctorId}/availability`);
      setAvailabilities(Array.isArray(response) ? response : []);
    } catch {
      addToast("error", "Failed to load availability schedule");
    } finally {
      setLoading(false);
    }
  }, [doctorId, addToast]);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  // Get availabilities for a specific day
  const getAvailabilitiesForDay = (day: string): Availability[] => {
    return availabilities.filter((a) => a.dayOfWeek === day && a.status === "ACTIVE");
  };

  // Calculate total slots for a day
  const calculateSlots = (avail: Availability): number => {
    const start = parseInt(avail.startTime.split(":")[0]) * 60 + parseInt(avail.startTime.split(":")[1]);
    const end = parseInt(avail.endTime.split(":")[0]) * 60 + parseInt(avail.endTime.split(":")[1]);
    return Math.floor((end - start) / avail.slotDurationMinutes);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.departmentId) {
      addToast("error", "Please select a department");
      return;
    }

    setSaving(true);
    try {
      if (bulkMode && selectedDays.length > 0) {
        // Bulk create - apiClient throws on error, returns data directly on success
        await apiClient.post(`/api/masters/doctors/${doctorId}/availability`, {
          ...formData,
          daysOfWeek: selectedDays,
          maxPatientsPerDay: formData.maxPatientsPerDay || null,
          effectiveTo: formData.effectiveTo || null,
        });

        addToast("success", `Availability created for ${selectedDays.length} days`);
        setShowAddDialog(false);
        setBulkMode(false);
        setSelectedDays([]);
        setFormData(initialFormData);
        fetchAvailabilities();
      } else {
        // Single create
        await apiClient.post(`/api/masters/doctors/${doctorId}/availability`, {
          ...formData,
          maxPatientsPerDay: formData.maxPatientsPerDay || null,
          effectiveTo: formData.effectiveTo || null,
        });

        addToast("success", "Availability created successfully");
        setShowAddDialog(false);
        setFormData(initialFormData);
        fetchAvailabilities();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save availability";
      addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  // Handle update
  const handleUpdate = async () => {
    if (!editingAvailability) return;

    setSaving(true);
    try {
      await apiClient.put(
        `/api/masters/doctors/${doctorId}/availability/${editingAvailability.id}`,
        {
          ...formData,
          maxPatientsPerDay: formData.maxPatientsPerDay || null,
          effectiveTo: formData.effectiveTo || null,
          version: editingAvailability.version,
        }
      );

      addToast("success", "Availability updated successfully");
      setShowEditDialog(false);
      setEditingAvailability(null);
      setFormData(initialFormData);
      fetchAvailabilities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update availability";
      addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  // Handle copy
  const handleCopy = async () => {
    if (!copySource || copyTargetDays.length === 0) return;

    setSaving(true);
    try {
      await apiClient.post(`/api/masters/doctors/${doctorId}/availability/copy`, {
        sourceAvailabilityId: copySource.id,
        targetDays: copyTargetDays,
        replaceExisting: false,
      });

      addToast("success", `Copied to ${copyTargetDays.length} days`);
      setShowCopyDialog(false);
      setCopySource(null);
      setCopyTargetDays([]);
      fetchAvailabilities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy availability";
      addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      await apiClient.delete(
        `/api/masters/doctors/${doctorId}/availability/${deleteTarget.id}`
      );

      addToast("success", "Availability deleted");
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchAvailabilities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete availability";
      addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (avail: Availability) => {
    setEditingAvailability(avail);
    setFormData({
      departmentId: avail.departmentId,
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime,
      slotDurationMinutes: avail.slotDurationMinutes,
      maxPatientsPerSlot: avail.maxPatientsPerSlot,
      maxPatientsPerDay: avail.maxPatientsPerDay,
      allowWalkIn: avail.allowWalkIn,
      walkInSlotReservation: avail.walkInSlotReservation,
      effectiveFrom: avail.effectiveFrom.split("T")[0],
      effectiveTo: avail.effectiveTo ? avail.effectiveTo.split("T")[0] : "",
      status: avail.status,
    });
    setShowEditDialog(true);
  };

  // Open copy dialog
  const openCopyDialog = (avail: Availability) => {
    setCopySource(avail);
    setCopyTargetDays([]);
    setShowCopyDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (avail: Availability) => {
    setDeleteTarget(avail);
    setShowDeleteDialog(true);
  };

  // Toggle day selection for bulk/copy
  const toggleDay = (day: string, list: string[], setList: (days: string[]) => void) => {
    if (list.includes(day)) {
      setList(list.filter((d) => d !== day));
    } else {
      setList([...list, day]);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Weekly Schedule</h3>
          <p className="text-sm text-muted-foreground">
            Manage availability for {doctorName}
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Availability
        </Button>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-7 gap-2">
        {DAYS_OF_WEEK.map((day) => {
          const dayAvailabilities = getAvailabilitiesForDay(day);
          return (
            <Card key={day} className="min-h-[200px]">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  {DAY_LABELS[day]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                {dayAvailabilities.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    No availability
                  </div>
                ) : (
                  dayAvailabilities.map((avail) => (
                    <div
                      key={avail.id}
                      className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {avail.startTime} - {avail.endTime}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {avail.department.code}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{avail.slotDurationMinutes}m</span>
                        <Users className="h-3 w-3 ml-1" />
                        <span>{avail.maxPatientsPerSlot}/slot</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{calculateSlots(avail)} slots</span>
                        {avail.allowWalkIn && (
                          <Badge variant="secondary" className="text-[9px]">Walk-in</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openEditDialog(avail)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openCopyDialog(avail)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => openDeleteDialog(avail)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowEditDialog(false);
          setEditingAvailability(null);
          setFormData(initialFormData);
          setBulkMode(false);
          setSelectedDays([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? "Edit Availability" : "Add Availability"}
            </DialogTitle>
            <DialogDescription>
              Configure the doctor&apos;s availability schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Department */}
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(val) => setFormData({ ...formData, departmentId: val })}
                disabled={showEditDialog}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day selection */}
            {!showEditDialog && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Day(s) of Week *</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bulkMode"
                      checked={bulkMode}
                      onCheckedChange={(checked) => {
                        setBulkMode(!!checked);
                        if (!checked) setSelectedDays([]);
                      }}
                    />
                    <label htmlFor="bulkMode" className="text-sm">
                      Multiple days
                    </label>
                  </div>
                </div>
                {bulkMode ? (
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day}
                        variant={selectedDays.includes(day) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(day, selectedDays, setSelectedDays)}
                      >
                        {DAY_LABELS[day]}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Select
                    value={formData.dayOfWeek}
                    onValueChange={(val) => setFormData({ ...formData, dayOfWeek: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>
                          {DAY_LABELS[day]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {showEditDialog && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Input value={DAY_LABELS[formData.dayOfWeek]} disabled />
              </div>
            )}

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Slot settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot Duration (min)</Label>
                <Select
                  value={formData.slotDurationMinutes.toString()}
                  onValueChange={(val) => setFormData({ ...formData, slotDurationMinutes: parseInt(val) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30, 45, 60].map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Patients per Slot</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.maxPatientsPerSlot}
                  onChange={(e) => setFormData({ ...formData, maxPatientsPerSlot: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Patients per Day (optional)</Label>
              <Input
                type="number"
                min={1}
                placeholder="No limit"
                value={formData.maxPatientsPerDay || ""}
                onChange={(e) => setFormData({ ...formData, maxPatientsPerDay: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>

            {/* Walk-in settings */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowWalkIn"
                  checked={formData.allowWalkIn}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowWalkIn: !!checked })}
                />
                <label htmlFor="allowWalkIn" className="text-sm">
                  Allow walk-ins
                </label>
              </div>
              {formData.allowWalkIn && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Reserve slots:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    className="w-16"
                    value={formData.walkInSlotReservation}
                    onChange={(e) => setFormData({ ...formData, walkInSlotReservation: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>

            {/* Effective dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective To (optional)</Label>
                <Input
                  type="date"
                  value={formData.effectiveTo}
                  onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                />
              </div>
            </div>

            {/* Status */}
            {showEditDialog && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              setShowEditDialog(false);
            }}>
              Cancel
            </Button>
            <Button onClick={showEditDialog ? handleUpdate : handleSubmit} disabled={saving}>
              {saving ? "Saving..." : showEditDialog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCopyDialog(false);
          setCopySource(null);
          setCopyTargetDays([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Availability</DialogTitle>
            <DialogDescription>
              Copy {copySource?.startTime} - {copySource?.endTime} ({DAY_LABELS[copySource?.dayOfWeek || ""]}) to other days
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Label>Select target days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.filter((day) => day !== copySource?.dayOfWeek).map((day) => (
                <Button
                  key={day}
                  variant={copyTargetDays.includes(day) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day, copyTargetDays, setCopyTargetDays)}
                >
                  {DAY_LABELS[day]}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopy} disabled={saving || copyTargetDays.length === 0}>
              {saving ? "Copying..." : `Copy to ${copyTargetDays.length} days`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteDialog(false);
          setDeleteTarget(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Availability
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the availability for{" "}
              <strong>{DAY_LABELS[deleteTarget?.dayOfWeek || ""]}</strong> ({deleteTarget?.startTime} - {deleteTarget?.endTime})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
