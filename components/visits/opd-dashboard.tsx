"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/lib/utils";
import { fetchApi } from "@/lib/api-client";

interface OPDVisit {
  id: string;
  visitNumber: number;
  status: string;
  priority: string;
  checkInTime: string;
  patient: {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phoneNumber: string;
  };
  doctor?: {
    id: string;
    fullName: string;
  } | null;
  department: {
    id: string;
    name: string;
  };
  appointment?: {
    appointmentDate: string;
    appointmentTime: string;
    tokenNumber: number | null;
  } | null;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface OPDDashboardProps {
  initialDepartmentId?: string;
  mode?: "reception" | "doctor"; // reception for reception staff, doctor for doctors
}

export function OPDDashboard({
  initialDepartmentId,
  mode = "reception",
}: OPDDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [visits, setVisits] = useState<OPDVisit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>(
    initialDepartmentId || ""
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch OPD visits
  const fetchOPDVisits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        doctorQueue: mode === "doctor" ? "true" : "false",
      });

      if (selectedDept) {
        params.append("departmentId", selectedDept);
      }

      const response = await fetchApi(
        `/api/visits/opd?${params.toString()}`,
        { method: "GET" }
      );

      setVisits(response.data.visits || []);
      setDepartments(response.data.departments || []);
      setTotal(response.data.pagination?.total || 0);
      setTotalPages(response.data.pagination?.pages || 0);

      // Auto-select first department if not selected
      if (!selectedDept && response.data.departments?.length > 0) {
        setSelectedDept(response.data.departments[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch OPD visits:", error);
      toast({
        title: "Error",
        description: "Failed to load OPD visits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOPDVisits();
  }, [page, limit, selectedDept, mode]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { variant: "default" | "secondary" | "destructive"; icon: any; label: string }
    > = {
      WAITING: { variant: "secondary", icon: Clock, label: "Waiting" },
      IN_PROGRESS: { variant: "default", icon: CheckCircle2, label: "Consulting" },
      COMPLETED: { variant: "secondary", icon: CheckCircle2, label: "Done" },
      CANCELLED: { variant: "destructive", icon: AlertTriangle, label: "Cancelled" },
    };

    const config = statusConfig[status] || { variant: "default", label: status };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon && <config.icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<
      string,
      { variant: "default" | "secondary" | "destructive"; icon: any; label: string }
    > = {
      EMERGENCY: { variant: "destructive", icon: AlertTriangle, label: "Emergency" },
      URGENT: { variant: "default", icon: AlertCircle, label: "Urgent" },
      NORMAL: { variant: "secondary", icon: Clock, label: "Normal" },
      LOW: { variant: "secondary", icon: Clock, label: "Low" },
    };

    const config = priorityConfig[priority] || { variant: "secondary", label: priority };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon && <config.icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const handleCheckIn = async (visitId: string) => {
    try {
      const response = await fetchApi(`/api/visits/${visitId}/checkin`, {
        method: "PUT",
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Patient checked in successfully",
        });
        fetchOPDVisits();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check in patient",
        variant: "destructive",
      });
    }
  };

  const handleStartConsultation = (visitId: string) => {
    router.push(`/consultations?visitId=${visitId}`);
  };

  const columns = [
    {
      header: "Token",
      accessor: "visitNumber",
      className: "font-semibold text-center w-12",
      cell: (visit: OPDVisit) => (
        <div className="text-center font-bold text-lg">{visit.visitNumber}</div>
      ),
    },
    {
      header: "Patient",
      accessor: "patient",
      className: "flex-1 min-w-[200px]",
      cell: (visit: OPDVisit) => (
        <div>
          <div className="font-semibold">
            {visit.patient.firstName} {visit.patient.lastName}
          </div>
          <div className="text-sm text-gray-500">{visit.patient.uhid}</div>
        </div>
      ),
    },
    {
      header: "Age / Gender",
      accessor: "patient",
      className: "text-center w-20",
      cell: (visit: OPDVisit) => (
        <div className="text-sm">
          <div className="font-medium">
            {calculateAge(visit.patient.dateOfBirth)} yrs
          </div>
          <div className="text-gray-500">{visit.patient.gender}</div>
        </div>
      ),
    },
    {
      header: "Priority",
      accessor: "priority",
      className: "w-24",
      cell: (visit: OPDVisit) => getPriorityBadge(visit.priority),
    },
    {
      header: "Status",
      accessor: "status",
      className: "w-24",
      cell: (visit: OPDVisit) => getStatusBadge(visit.status),
    },
    {
      header: "Check-in",
      accessor: "checkInTime",
      className: "text-sm text-gray-600 w-32",
      cell: (visit: OPDVisit) => (
        <div>
          <div>{format(new Date(visit.checkInTime), "HH:mm")}</div>
          <div className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(visit.checkInTime), {
              addSuffix: true,
            })}
          </div>
        </div>
      ),
    },
    {
      header: "Doctor",
      accessor: "doctor",
      className: "w-32",
      cell: (visit: OPDVisit) => (
        <div className="text-sm">
          {visit.doctor ? (
            visit.doctor.fullName
          ) : (
            <span className="text-gray-400">Not assigned</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "id",
      className: "text-right w-40",
      cell: (visit: OPDVisit) => (
        <div className="flex gap-2 justify-end">
          {visit.status === "WAITING" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCheckIn(visit.id)}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              Check-in
            </Button>
          )}
          {visit.status === "WAITING" && (
            <Button
              size="sm"
              onClick={() => handleStartConsultation(visit.id)}
              className="gap-1"
            >
              <Users className="h-4 w-4" />
              Consult
            </Button>
          )}
          {visit.status === "IN_PROGRESS" && (
            <Button
              size="sm"
              onClick={() => handleStartConsultation(visit.id)}
              className="gap-1"
            >
              <ChevronRight className="h-4 w-4" />
              Continue
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {mode === "doctor" ? "Doctor Queue" : "OPD Dashboard"}
          </h1>
          <p className="text-gray-600 mt-1">
            {mode === "doctor"
              ? "View your pending consultations"
              : "Manage out-patient department visits"}
          </p>
        </div>
      </div>

      {/* Department Filter */}
      {departments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {departments.map((dept) => (
            <Button
              key={dept.id}
              variant={selectedDept === dept.id ? "default" : "outline"}
              onClick={() => {
                setSelectedDept(dept.id);
                setPage(1);
              }}
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              {dept.name}
            </Button>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Waiting</p>
              <p className="text-2xl font-bold">
                {visits.filter((v) => v.status === "WAITING").length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Consulting</p>
              <p className="text-2xl font-bold">
                {visits.filter((v) => v.status === "IN_PROGRESS").length}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Today</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Visits Table */}
      <Card className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No OPD visits found</p>
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={visits} />
            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {visits.length} of {total} visits
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={page === p ? "default" : "outline"}
                      onClick={() => setPage(p)}
                      size="sm"
                      className="w-8"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// Import icon that was missing
import { Building2 } from "lucide-react";
