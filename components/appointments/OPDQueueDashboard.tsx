"use client";

/**
 * OPD Queue Dashboard
 * 
 * Real-time queue management for OPD with:
 * - Live queue status
 * - Check-in functionality
 * - Token-based ordering
 * - Walk-in support
 */

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import AppointmentBookingDrawer from "./AppointmentBookingDrawer";
import {
  Users,
  Clock,
  UserCheck,
  Play,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  PersonStanding,
  Loader2,
} from "lucide-react";

// Types
interface Appointment {
  id: string;
  tokenNumber: number | null;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string | null;
  slotEndTime: string | null;
  status: string;
  isWalkIn: boolean;
  chiefComplaint: string | null;
  checkedInAt: string | null;
  patient: {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
  };
  doctorMaster?: {
    id: string;
    doctorCode: string;
    fullName: string;
  } | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface QueueStats {
  total: number;
  waiting: number;
  checkedIn: number;
  inProgress: number;
  walkIns: number;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Doctor {
  id: string;
  doctorCode: string;
  fullName: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  BOOKED: { label: "Booked", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  CONFIRMED: { label: "Confirmed", variant: "secondary", icon: <CheckCircle className="h-3 w-3" /> },
  RESCHEDULED: { label: "Rescheduled", variant: "outline", icon: <Calendar className="h-3 w-3" /> },
  CHECKED_IN: { label: "Checked In", variant: "default", icon: <UserCheck className="h-3 w-3" /> },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: <Play className="h-3 w-3" /> },
  COMPLETED: { label: "Completed", variant: "secondary", icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  NO_SHOW: { label: "No Show", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
};

export default function OPDQueueDashboard() {
  const { addToast } = useToast();

  // State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [showBookingDrawer, setShowBookingDrawer] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isWalkIn, setIsWalkIn] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments();
  }, []);

  // Fetch doctors when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchDoctors(selectedDepartment);
      setSelectedDoctor("");
    }
  }, [selectedDepartment]);

  // Fetch queue when filters change
  useEffect(() => {
    if (selectedDepartment) {
      fetchQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedDoctor, selectedDate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!selectedDepartment) return;

    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedDoctor, selectedDate]);

  const fetchDepartments = async () => {
    try {
      // apiClient.get returns data directly (array of departments)
      const response = await apiClient.get("/api/masters/departments?status=ACTIVE");
      setDepartments(Array.isArray(response) ? response : []);
    } catch {
      console.error("Error fetching departments");
    }
  };

  const fetchDoctors = async (departmentId: string) => {
    try {
      // apiClient.get returns data directly (array of doctors)
      const response = await apiClient.get(
        `/api/masters/doctors?departmentId=${departmentId}&status=ACTIVE`
      );
      setDoctors(Array.isArray(response) ? response : []);
    } catch {
      console.error("Error fetching doctors");
    }
  };

  const fetchQueue = useCallback(async () => {
    if (!selectedDepartment) return;

    setLoading(true);
    try {
      let url = `/api/appointments/queue?departmentId=${selectedDepartment}&date=${selectedDate}`;
      if (selectedDoctor) {
        url += `&doctorId=${selectedDoctor}`;
      }

      // apiClient.get returns data directly
      const response = await apiClient.get(url);
      setQueue(response?.queue || []);
      setStats(response?.stats || null);
    } catch (error) {
      console.error("Error fetching queue:", error);
      addToast("error", "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [selectedDepartment, selectedDoctor, selectedDate, addToast]);

  // Actions
  const handleCheckIn = async (appointmentId: string) => {
    setActionLoading(appointmentId);
    try {
      await apiClient.post(`/api/appointments/${appointmentId}/checkin`, {});
      addToast("success", "Patient checked in");
      fetchQueue();
    } catch {
      addToast("error", "Failed to check in");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartConsultation = async (appointmentId: string) => {
    setActionLoading(appointmentId);
    try {
      await apiClient.post(`/api/appointments/${appointmentId}/start`, {});
      addToast("success", "Consultation started");
      fetchQueue();
    } catch {
      addToast("error", "Failed to start consultation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (appointmentId: string) => {
    setActionLoading(appointmentId);
    try {
      await apiClient.post(`/api/appointments/${appointmentId}/complete`, {});
      addToast("success", "Appointment completed");
      fetchQueue();
    } catch {
      addToast("error", "Failed to complete");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason) return;

    setActionLoading(cancelTarget.id);
    try {
      await apiClient.post(`/api/appointments/${cancelTarget.id}/cancel`, {
        cancelReason,
      });
      addToast("success", "Appointment cancelled");
      setShowCancelDialog(false);
      setCancelTarget(null);
      setCancelReason("");
      fetchQueue();
    } catch {
      addToast("error", "Failed to cancel");
    } finally {
      setActionLoading(null);
    }
  };

  const openCancelDialog = (appointment: Appointment) => {
    setCancelTarget(appointment);
    setCancelReason("");
    setShowCancelDialog(true);
  };

  // Filter queue by search
  const filteredQueue = queue.filter((apt) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      apt.patient.uhid.toLowerCase().includes(search) ||
      apt.patient.firstName.toLowerCase().includes(search) ||
      apt.patient.lastName.toLowerCase().includes(search) ||
      apt.tokenNumber?.toString().includes(search)
    );
  });

  const openBookingDrawer = (walkIn: boolean = false) => {
    setIsWalkIn(walkIn);
    setShowBookingDrawer(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">OPD Queue</h2>
          <p className="text-muted-foreground">Manage patient appointments and queue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchQueue} disabled={!selectedDepartment}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => openBookingDrawer(true)}>
            <PersonStanding className="h-4 w-4 mr-2" />
            Walk-In
          </Button>
          <Button onClick={() => openBookingDrawer(false)}>
            <Plus className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department *</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Doctor</label>
              <Select
                value={selectedDoctor}
                onValueChange={setSelectedDoctor}
                disabled={!selectedDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All doctors</SelectItem>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Token, UHID, name..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.waiting}</p>
                  <p className="text-sm text-muted-foreground">Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <UserCheck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.checkedIn}</p>
                  <p className="text-sm text-muted-foreground">Checked In</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Play className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <PersonStanding className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.walkIns}</p>
                  <p className="text-sm text-muted-foreground">Walk-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue Table */}
      <Card>
        <CardContent className="p-0">
          {!selectedDepartment ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please select a department to view the queue</p>
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No appointments found for the selected criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((apt) => {
                  const statusConfig = STATUS_CONFIG[apt.status] || STATUS_CONFIG.BOOKED;
                  const isLoading = actionLoading === apt.id;

                  return (
                    <TableRow key={apt.id}>
                      <TableCell>
                        <span className="text-lg font-bold text-primary">
                          #{apt.tokenNumber || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {apt.patient.firstName} {apt.patient.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {apt.patient.uhid}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {apt.doctorMaster ? (
                          <div>
                            <p className="font-medium">{apt.doctorMaster.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              {apt.doctorMaster.doctorCode}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{apt.appointmentTime || "-"}</p>
                          {apt.checkedInAt && (
                            <p className="text-xs text-muted-foreground">
                              Checked in: {new Date(apt.checkedInAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {apt.isWalkIn ? (
                          <Badge variant="secondary">Walk-in</Badge>
                        ) : (
                          <Badge variant="outline">Scheduled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(apt.status === "BOOKED" || apt.status === "CONFIRMED" || apt.status === "RESCHEDULED") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckIn(apt.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {apt.status === "CHECKED_IN" && (
                            <Button
                              size="sm"
                              onClick={() => handleStartConsultation(apt.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Start
                                </>
                              )}
                            </Button>
                          )}
                          {apt.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              onClick={() => handleComplete(apt.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete
                                </>
                              )}
                            </Button>
                          )}
                          {!["COMPLETED", "CANCELLED", "NO_SHOW", "IN_PROGRESS"].includes(apt.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => openCancelDialog(apt)}
                              disabled={isLoading}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Booking Drawer */}
      <AppointmentBookingDrawer
        open={showBookingDrawer}
        onClose={() => setShowBookingDrawer(false)}
        onSuccess={() => fetchQueue()}
        isWalkIn={isWalkIn}
      />

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the appointment for{" "}
              <strong>
                {cancelTarget?.patient.firstName} {cancelTarget?.patient.lastName}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cancellation Reason *</label>
            <Input
              placeholder="Enter reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason || actionLoading === cancelTarget?.id}
            >
              {actionLoading === cancelTarget?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
