"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Stethoscope,
  AlertTriangle,
  AlertCircle,
  Clock,
  Phone,
  FileText,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/utils";
import { fetchApi } from "@/lib/api-client";

interface Visit {
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
    bloodGroup: string;
    allergies: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  vitals: Array<{
    bloodPressureSystolic: number | null;
    bloodPressureDiastolic: number | null;
    pulseRate: number | null;
    temperature: number | null;
    spO2: number | null;
    weight: number | null;
    height: number | null;
    recordedAt: string;
  }>;
  consultations: Array<{
    id: string;
    consultationDate: string;
    status: string;
  }>;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
}

export function DoctorOPDQueue() {
  const router = useRouter();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Fetch doctor's OPD queue
  const fetchDoctorQueue = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        doctorQueue: "true",
      });

      if (selectedDept) {
        params.append("departmentId", selectedDept);
      }

      const response = await fetchApi(`/api/visits/opd?${params.toString()}`, {
        method: "GET",
      });

      setVisits(response.data.visits || []);
      setDepartments(response.data.departments || []);
      setTotal(response.data.pagination?.total || 0);

      // Auto-select first department if not selected
      if (!selectedDept && response.data.departments?.length > 0) {
        setSelectedDept(response.data.departments[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch doctor queue:", error);
      toast({
        title: "Error",
        description: "Failed to load your OPD queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorQueue();
  }, [page, limit, selectedDept]);

  const handleStartConsultation = (visitId: string) => {
    router.push(`/consultations?visitId=${visitId}`);
  };

  const handleViewVitals = (visitId: string) => {
    router.push(`/vitals?visitId=${visitId}`);
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "EMERGENCY":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "URGENT":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case "NORMAL":
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "EMERGENCY":
        return "bg-red-50 border-red-200";
      case "URGENT":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      WAITING: { variant: "secondary", label: "Waiting" },
      IN_PROGRESS: { variant: "default", label: "In Progress" },
      COMPLETED: { variant: "secondary", label: "Completed" },
    };

    const cfg = config[status] || { variant: "secondary", label: status };
    return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Your OPD Queue</h1>
        </div>
        <p className="text-gray-600">
          {visits.length} patient{visits.length !== 1 ? "s" : ""} waiting for
          consultation
        </p>
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
              size="sm"
            >
              {dept.name}
            </Button>
          ))}
        </div>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Waiting for You</p>
              <p className="text-3xl font-bold">
                {visits.filter((v) => v.status === "WAITING").length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-3xl font-bold">
                {visits.filter((v) => v.status === "IN_PROGRESS").length}
              </p>
            </div>
            <Stethoscope className="h-10 w-10 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Queue List */}
      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </Card>
      ) : visits.length === 0 ? (
        <Card className="p-12 text-center">
          <Stethoscope className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg text-gray-600">No patients in queue</p>
          <p className="text-sm text-gray-500 mt-1">
            You're all caught up!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visits.map((visit, index) => (
            <Card
              key={visit.id}
              className={`p-4 border-2 cursor-pointer transition ${getPriorityColor(
                visit.priority
              )}`}
              onClick={() =>
                setExpandedVisitId(
                  expandedVisitId === visit.id ? null : visit.id
                )
              }
            >
              {/* Compact View */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Token Number */}
                  <div className="text-center min-w-[60px]">
                    <div className="text-2xl font-bold">
                      {index + 1}
                    </div>
                    <div className="text-xs text-gray-500">Token</div>
                  </div>

                  {/* Priority & Status */}
                  <div className="flex gap-2">
                    {getPriorityIcon(visit.priority)}
                    {getStatusBadge(visit.status)}
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1">
                    <p className="font-semibold">
                      {visit.patient.firstName} {visit.patient.lastName}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{visit.patient.uhid}</span>
                      <span>•</span>
                      <span>
                        {calculateAge(visit.patient.dateOfBirth)} yrs,{" "}
                        {visit.patient.gender}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {visit.patient.phoneNumber}
                      </span>
                    </div>
                  </div>

                  {/* Wait Time */}
                  <div className="text-right min-w-[120px]">
                    <div className="text-sm font-medium">
                      {format(new Date(visit.checkInTime), "HH:mm")}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(visit.checkInTime), {
                        addSuffix: false,
                      })}
                    </div>
                  </div>
                </div>

                {/* Expand Arrow */}
                <ChevronRight
                  className={`h-5 w-5 text-gray-400 transition ${
                    expandedVisitId === visit.id ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Expanded View */}
              {expandedVisitId === visit.id && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  {/* Vital Signs */}
                  {visit.vitals.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {visit.vitals[0].bloodPressureSystolic && (
                        <div className="bg-white p-2 rounded border">
                          <p className="text-xs text-gray-600">BP</p>
                          <p className="font-semibold">
                            {visit.vitals[0].bloodPressureSystolic}/
                            {visit.vitals[0].bloodPressureDiastolic}
                          </p>
                        </div>
                      )}
                      {visit.vitals[0].pulseRate && (
                        <div className="bg-white p-2 rounded border">
                          <p className="text-xs text-gray-600">Pulse</p>
                          <p className="font-semibold">
                            {visit.vitals[0].pulseRate} bpm
                          </p>
                        </div>
                      )}
                      {visit.vitals[0].temperature && (
                        <div className="bg-white p-2 rounded border">
                          <p className="text-xs text-gray-600">Temp</p>
                          <p className="font-semibold">
                            {visit.vitals[0].temperature}°C
                          </p>
                        </div>
                      )}
                      {visit.vitals[0].spO2 && (
                        <div className="bg-white p-2 rounded border">
                          <p className="text-xs text-gray-600">SpO2</p>
                          <p className="font-semibold">
                            {visit.vitals[0].spO2}%
                          </p>
                        </div>
                      )}
                      {visit.vitals[0].weight && (
                        <div className="bg-white p-2 rounded border">
                          <p className="text-xs text-gray-600">Weight</p>
                          <p className="font-semibold">
                            {visit.vitals[0].weight} kg
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Patient Details */}
                  {(visit.patient.bloodGroup || visit.patient.allergies) && (
                    <div className="bg-white p-3 rounded border space-y-2">
                      {visit.patient.bloodGroup && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Blood Group:</span>
                          <span className="font-medium">
                            {visit.patient.bloodGroup}
                          </span>
                        </div>
                      )}
                      {visit.patient.allergies && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Allergies:</span>
                          <span className="font-medium">
                            {visit.patient.allergies}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {visit.vitals.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewVitals(visit.id);
                        }}
                        className="flex-1 gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Record Vitals
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartConsultation(visit.id);
                      }}
                      className="flex-1 gap-2"
                    >
                      <Stethoscope className="h-4 w-4" />
                      Start Consultation
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(total / limit)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
