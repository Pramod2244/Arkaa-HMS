"use client";

/**
 * All Appointments List Component
 * 
 * Displays a searchable, filterable table of all appointments
 */

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { apiClient } from "@/lib/api-client";
import {
  Search,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// Types
interface Appointment {
  id: string;
  tokenNumber: number | null;
  appointmentDate: string;
  appointmentTime: string | null;
  status: string;
  isWalkIn: boolean;
  chiefComplaint: string | null;
  createdAt: string;
  patient: {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  doctorMaster?: {
    id: string;
    doctorCode: string;
    fullName: string;
  } | null;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  CHECKED_IN: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
  RESCHEDULED: "bg-orange-100 text-orange-800",
};

export default function AppointmentsList() {
  const { addToast } = useToast();

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments();
  }, []);

  // Fetch appointments when filters change
  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedDepartment, selectedStatus, selectedDate]);

  const fetchDepartments = async () => {
    try {
      const response = await apiClient.get("/api/masters/departments?status=ACTIVE");
      setDepartments(Array.isArray(response) ? response : []);
    } catch {
      console.error("Error fetching departments");
    }
  };

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/appointments?page=${page}&limit=${limit}`;
      if (selectedDepartment && selectedDepartment !== "all") {
        url += `&departmentId=${selectedDepartment}`;
      }
      if (selectedStatus && selectedStatus !== "all") {
        url += `&status=${selectedStatus}`;
      }
      if (selectedDate) {
        url += `&date=${selectedDate}`;
      }

      const response = await apiClient.get(url);
      setAppointments(response?.appointments || response?.data?.appointments || []);
      setTotal(response?.pagination?.total || response?.data?.pagination?.total || 0);
      setTotalPages(Math.ceil((response?.pagination?.total || response?.data?.pagination?.total || 0) / limit));
    } catch (error) {
      console.error("Error fetching appointments:", error);
      addToast("error", "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [page, selectedDepartment, selectedStatus, selectedDate, addToast]);

  // Filter appointments locally by search
  const filteredAppointments = appointments.filter((apt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      apt.patient.uhid.toLowerCase().includes(query) ||
      apt.patient.firstName.toLowerCase().includes(query) ||
      apt.patient.lastName.toLowerCase().includes(query) ||
      apt.patient.phoneNumber?.includes(query) ||
      apt.tokenNumber?.toString().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Appointments
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => fetchAppointments()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by UHID, name, phone, or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-[180px]">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-[180px]">
            <Select
              value={selectedDepartment}
              onValueChange={(v) => {
                setSelectedDepartment(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[150px]">
            <Select
              value={selectedStatus}
              onValueChange={(v) => {
                setSelectedStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No appointments found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Token</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-mono font-bold">
                        {apt.tokenNumber || "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {apt.patient.firstName} {apt.patient.lastName}
                          </p>
                          <p className="text-xs text-slate-500">{apt.patient.uhid}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(apt.appointmentDate)}</TableCell>
                      <TableCell>{formatTime(apt.appointmentTime)}</TableCell>
                      <TableCell>{apt.department?.name || "—"}</TableCell>
                      <TableCell>{apt.doctorMaster?.fullName || "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[apt.status] || "bg-gray-100"}>
                          {apt.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {apt.isWalkIn ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Walk-in
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Scheduled
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Showing {filteredAppointments.length} of {total} appointments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
