"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Loader2,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/lib/utils";
import { fetchApi } from "@/lib/api-client";
import { PatientSelector } from "@/components/patients/patient-selector";

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface Doctor {
  id: string;
  fullName: string;
}

interface OPDVisitCreateFormProps {
  onSuccess?: () => void;
}

export function OPDVisitCreateForm({ onSuccess }: OPDVisitCreateFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [notes, setNotes] = useState<string>("");

  // Fetch user's departments on component mount
  useEffect(() => {
    const fetchUserDepartments = async () => {
      try {
        setLoadingDepts(true);
        const response = await fetchApi("/api/visits/opd", {
          method: "GET",
        });
        setDepartments(response.data.departments || []);

        // Auto-select first department
        if (response.data.departments?.length > 0) {
          setSelectedDepartment(response.data.departments[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
        toast({
          title: "Error",
          description: "Failed to load departments",
          variant: "destructive",
        });
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchUserDepartments();
  }, [toast]);

  // Fetch doctors for selected department
  useEffect(() => {
    const fetchDepartmentDoctors = async () => {
      if (!selectedDepartment) return;

      try {
        setLoadingDoctors(true);
        const response = await fetchApi(
          `/api/departments/${selectedDepartment}/doctors`,
          { method: "GET" }
        );
        const doctorsData = (response as any)?.data?.doctors ?? (response as any)?.data ?? [];
        setDoctors(doctorsData);
        setSelectedDoctor(""); // Reset doctor selection
      } catch (error) {
        console.error("Failed to fetch doctors:", error);
        // Don't show toast here, doctor selection is optional
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDepartmentDoctors();
  }, [selectedDepartment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast({
        title: "Validation Error",
        description: "Please select a patient",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDepartment) {
      toast({
        title: "Validation Error",
        description: "Department is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetchApi("/api/visits/opd/create", {
        method: "POST",
        body: JSON.stringify({
          patientId: selectedPatient.id,
          departmentId: selectedDepartment,
          doctorId: selectedDoctor || undefined,
          priority,
          notes,
        }),
      });

      if (response.success) {
        toast({
          title: "Success",
          description: `OPD visit created for ${selectedPatient.firstName} ${selectedPatient.lastName}`,
        });

        // Reset form
        setSelectedPatient(null);
        setSelectedDoctor("");
        setPriority("NORMAL");
        setNotes("");
        setOpen(false);

        // Callback
        onSuccess?.();
      }
    } catch (error) {
      console.error("Failed to create OPD visit:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create OPD visit",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDeptName = departments.find(
    (d) => d.id === selectedDepartment
  )?.name;

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        New OPD Visit
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <div className="space-y-6 p-6 max-w-2xl mx-auto">
          <div>
            <h2 className="text-2xl font-bold">Create OPD Visit</h2>
            <p className="text-gray-600 text-sm mt-1">
              Register a new out-patient department visit
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Department Display (Read-only) */}
            {loadingDepts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">Loading departments...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Department <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      onClick={() => setSelectedDepartment(dept.id)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition ${
                        selectedDepartment === dept.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{dept.name}</span>
                          {dept.code && (
                            <Badge variant="secondary">{dept.code}</Badge>
                          )}
                        </div>
                        {selectedDepartment === dept.id && (
                          <CheckCircle2 className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {departments.length === 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">
                        No departments assigned
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        Contact admin to assign departments
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Patient Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Patient <span className="text-red-500">*</span>
              </label>
              {selectedPatient ? (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        UHID: {selectedPatient.uhid}
                      </p>
                      <p className="text-sm text-gray-600">
                        Phone: {selectedPatient.phoneNumber}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <PatientSelector
                  onSelect={setSelectedPatient}
                  placeholder="Search patient by name, UHID, or phone..."
                />
              )}
            </div>

            {/* Doctor Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Doctor <span className="text-gray-500">(Optional)</span>
              </label>
              {loadingDoctors ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600">Loading doctors...</span>
                </div>
              ) : (
                <Select
                  value={selectedDoctor}
                  onValueChange={setSelectedDoctor}
                >
                  <option value="">-- Assign doctor later --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fullName}
                    </option>
                  ))}
                </Select>
              )}
              {doctors.length === 0 && selectedDepartment && (
                <p className="text-xs text-gray-500">
                  No doctors available for {selectedDeptName}
                </p>
              )}
            </div>

            {/* Priority Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency</option>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 justify-end pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedPatient}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create OPD Visit
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Drawer>
    </>
  );
}
