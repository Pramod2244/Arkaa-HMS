"use client";

/**
 * Doctor OPD Dashboard
 * 
 * The primary operations screen for doctors showing:
 * - Today's queue (WAITING / IN_PROGRESS / COMPLETED)
 * - Quick stats panel
 * - Actions: START, RESUME, VIEW
 * - Auto-refresh with manual refresh option
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import {
  Users,
  Clock,
  Play,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  Eye,
  Loader2,
  Stethoscope,
  ArrowRight,
  UserCheck,
} from "lucide-react";

// Types
interface QueueItem {
  id: string;
  visitId: string;
  tokenNumber: number | null;
  patientName: string;
  patientUhid: string;
  patientPhone: string | null;
  patientGender: string | null;
  patientDob: string | null;
  visitType: string;
  status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: string;
  departmentName: string;
  checkInTime: string;
  startTime: string | null;
  endTime: string | null;
}

interface DoctorStats {
  waiting: number;
  inProgress: number;
  completed: number;
  currentToken: number | null;
  nextWaitingToken: number | null;
}

interface DoctorContext {
  doctorId: string;
  doctorName: string;
  departments: Array<{ id: string; name: string; code: string }>;
}

interface InProgressVisit {
  visitId: string;
  patientName: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  WAITING: { label: "Waiting", variant: "outline", color: "text-amber-600" },
  IN_PROGRESS: { label: "In Progress", variant: "default", color: "text-blue-600" },
  COMPLETED: { label: "Completed", variant: "secondary", color: "text-green-600" },
  CANCELLED: { label: "Cancelled", variant: "destructive", color: "text-red-600" },
};

export default function DoctorDashboard() {
  const router = useRouter();
  const { addToast } = useToast();

  // State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [doctorContext, setDoctorContext] = useState<DoctorContext | null>(null);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog state
  const [showInProgressDialog, setShowInProgressDialog] = useState(false);
  const [inProgressVisit, setInProgressVisit] = useState<InProgressVisit | null>(null);
  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch queue when department filter changes
  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue();
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchQueue(), fetchStats()]);
    setLoading(false);
  };

  const fetchQueue = useCallback(async () => {
    try {
      let url = "/api/doctor/queue?";
      if (selectedDepartment && selectedDepartment !== "all") {
        url += `departmentId=${selectedDepartment}&`;
      }
      if (selectedStatus && selectedStatus !== "all") {
        url += `status=${selectedStatus}&`;
      }

      const response = await apiClient.get(url);
      // apiClient.get returns data directly (unwrapped from { success, data })
      setQueue(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  }, [selectedDepartment, selectedStatus]);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get("/api/doctor/stats");
      // apiClient.get returns data directly: { stats, doctor }
      setStats(response?.stats || null);
      setDoctorContext(response?.doctor || null);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleStartConsultation = async (visitId: string, force: boolean = false) => {
    setActionLoading(visitId);
    try {
      // apiClient.post unwraps response and returns data directly
      // API returns { success, data: { visitId, redirectTo } }
      // apiClient returns { visitId, redirectTo }
      const result = await apiClient.post<{ visitId: string; redirectTo: string }>(
        "/api/doctor/start-consultation",
        { visitId, force }
      );

      // If we get here without error, it was successful
      addToast("success", "Consultation started");
      router.push(result?.redirectTo || `/consultation/${visitId}`);
    } catch (error: unknown) {
      // Check if it's an in-progress conflict
      const apiError = error as { data?: { errorCode?: string; data?: InProgressVisit } };
      if (apiError?.data?.errorCode === "HAS_IN_PROGRESS") {
        setInProgressVisit(apiError.data?.data || null);
        setPendingVisitId(visitId);
        setShowInProgressDialog(true);
      } else {
        addToast("error", "Failed to start consultation");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleForceStart = async () => {
    if (pendingVisitId) {
      setShowInProgressDialog(false);
      await handleStartConsultation(pendingVisitId, true);
    }
  };

  const handleResumeConsultation = (visitId: string) => {
    router.push(`/consultation/${visitId}`);
  };

  const handleViewConsultation = (visitId: string) => {
    router.push(`/consultation/${visitId}?viewOnly=true`);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchData();
    addToast("success", "Queue refreshed");
    setLoading(false);
  };

  // Filter queue by search
  const filteredQueue = queue.filter((item) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      item.patientUhid.toLowerCase().includes(search) ||
      item.patientName.toLowerCase().includes(search) ||
      item.tokenNumber?.toString().includes(search)
    );
  });

  // Render action button based on status
  const renderActionButton = (item: QueueItem) => {
    const isLoading = actionLoading === item.visitId;

    switch (item.status) {
      case "WAITING":
        return (
          <Button
            size="sm"
            onClick={() => handleStartConsultation(item.visitId)}
            disabled={isLoading}
            className="gap-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start
              </>
            )}
          </Button>
        );
      case "IN_PROGRESS":
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleResumeConsultation(item.visitId)}
            className="gap-1"
          >
            <ArrowRight className="h-4 w-4" />
            Resume
          </Button>
        );
      case "COMPLETED":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewConsultation(item.visitId)}
            className="gap-1"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" />
            My OPD Dashboard
          </h2>
          <p className="text-muted-foreground">
            {doctorContext?.doctorName ? `Dr. ${doctorContext.doctorName}` : "Today's consultations"}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
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

          <Card className={stats.inProgress > 0 ? "ring-2 ring-blue-500" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Play className="h-5 w-5 text-blue-500" />
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
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.currentToken ? `#${stats.currentToken}` : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">Current</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.nextWaitingToken ? `#${stats.nextWaitingToken}` : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">Next Up</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All My Departments</SelectItem>
                  {doctorContext?.departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Token, UHID, patient name..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Today&apos;s Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No patients in your queue</p>
              <p className="text-sm mt-1">Patients will appear here when they check in</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Check-in Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.WAITING;
                  const isCurrentInProgress = item.status === "IN_PROGRESS";

                  return (
                    <TableRow 
                      key={item.id} 
                      className={isCurrentInProgress ? "bg-blue-50 dark:bg-blue-950/20" : ""}
                    >
                      <TableCell>
                        <span className={`text-lg font-bold ${isCurrentInProgress ? "text-blue-600" : "text-primary"}`}>
                          #{item.tokenNumber || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.patientName}</p>
                          <p className="text-sm text-muted-foreground">{item.patientUhid}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.priority === "EMERGENCY" ? "destructive" : item.priority === "URGENT" ? "default" : "outline"}>
                          {item.priority || "NORMAL"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.departmentName || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {item.checkInTime
                            ? new Date(item.checkInTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          {item.status === "WAITING" && <Clock className="h-3 w-3" />}
                          {item.status === "IN_PROGRESS" && <Play className="h-3 w-3" />}
                          {item.status === "COMPLETED" && <CheckCircle className="h-3 w-3" />}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderActionButton(item)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* In-Progress Warning Dialog */}
      <Dialog open={showInProgressDialog} onOpenChange={setShowInProgressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Active Consultation Detected
            </DialogTitle>
            <DialogDescription>
              You have an in-progress consultation with{" "}
              <strong>{inProgressVisit?.patientName}</strong>. You should complete or abandon 
              that consultation before starting a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowInProgressDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowInProgressDialog(false);
                if (inProgressVisit?.visitId) {
                  handleResumeConsultation(inProgressVisit.visitId);
                }
              }}
            >
              Resume Previous
            </Button>
            <Button variant="destructive" onClick={handleForceStart}>
              Start Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
