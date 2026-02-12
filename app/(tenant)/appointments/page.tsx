"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import OPDQueueDashboard from "@/components/appointments/OPDQueueDashboard";
import AppointmentsList from "@/components/appointments/AppointmentsList";
import AvailabilityManagement from "@/components/appointments/AvailabilityManagement";
import { apiClient } from "@/lib/api-client";
import { Calendar, Users, ListOrdered, Loader2 } from "lucide-react";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Doctor {
  id: string;
  doctorCode: string;
  fullName: string;
  primaryDepartmentId: string;
}

export default function AppointmentsPage() {
  // Doctor schedule states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoadingDepartments(true);
      try {
        // apiClient.get returns data directly (array of departments)
        const response = await apiClient.get("/api/masters/departments?status=ACTIVE");
        setDepartments(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Error fetching departments:", error);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch doctors when department changes
  useEffect(() => {
    if (!selectedDepartment) {
      setDoctors([]);
      setSelectedDoctor(null);
      return;
    }

    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      try {
        // apiClient.get returns data directly (array of doctors)
        const response = await apiClient.get(
          `/api/masters/doctors?departmentId=${selectedDepartment}&status=ACTIVE`
        );
        setDoctors(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Error fetching doctors:", error);
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
    setSelectedDoctor(null);
  }, [selectedDepartment]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Appointments & OPD Queue</h1>
        <p className="mt-2 text-slate-600">
          Manage appointments, walk-ins, and OPD patient queue
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            OPD Queue
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="h-4 w-4" />
            All Appointments
          </TabsTrigger>
          <TabsTrigger value="doctors" className="gap-2">
            <Users className="h-4 w-4" />
            Doctor Schedules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <OPDQueueDashboard />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsList />
        </TabsContent>

        <TabsContent value="doctors">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Doctor Selection */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Department
                  </Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select Department"} />
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

                <div className="flex-1 min-w-[200px]">
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Doctor
                  </Label>
                  <Select
                    value={selectedDoctor?.id || ""}
                    onValueChange={(value) => {
                      const doctor = doctors.find((d) => d.id === value);
                      setSelectedDoctor(doctor || null);
                    }}
                    disabled={!selectedDepartment || loadingDoctors}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingDoctors
                            ? "Loading..."
                            : !selectedDepartment
                            ? "Select department first"
                            : "Select Doctor"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.fullName} ({doc.doctorCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Availability Content */}
            <div className="p-4">
              {loadingDepartments || loadingDoctors ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : !selectedDoctor ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-16 w-16 text-slate-300 mb-4" />
                  <h2 className="text-xl font-semibold text-slate-700 mb-2">
                    Select a Doctor
                  </h2>
                  <p className="text-slate-500 text-center max-w-md">
                    Choose a department and doctor to view and manage their availability schedule.
                  </p>
                </div>
              ) : (
                <AvailabilityManagement
                  doctorId={selectedDoctor.id}
                  doctorName={selectedDoctor.fullName}
                  departments={departments}
                />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
