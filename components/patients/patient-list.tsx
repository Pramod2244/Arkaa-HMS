"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Download, Upload, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientFormDrawer } from "./patient-form-drawer";
import { PatientDetailsDrawer } from "./patient-details-drawer";
import { usePatientSelection } from "@/contexts/patient-selection-context";
import { calculateAge } from "@/lib/utils/date-utils";

interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  phoneNumber: string;
  email?: string;
  bloodGroup?: "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE";
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

interface PatientsResponse {
  success: boolean;
  data: {
    patients: Patient[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function PatientList() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const { setSelectedPatient } = usePatientSelection();

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
        ...(statusFilter && statusFilter !== "ALL" && { status: statusFilter }),
      });

      const response = await fetch(`/api/patients?${params}`);
      const data: PatientsResponse = await response.json();

      if (data.success) {
        setPatients(data.data.patients);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreatePatient = () => {
    setEditingPatient(null);
    setShowFormDrawer(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setShowFormDrawer(true);
  };

  const handleViewPatient = (patient: Patient) => {
    setViewingPatient(patient);
    setShowDetailsDrawer(true);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
  };

  const handleFormSuccess = () => {
    setShowFormDrawer(false);
    setEditingPatient(null);
    fetchPatients();
  };

  const handleCheckboxChange = (patientId: string, checked: boolean) => {
    if (checked) {
      setSelectedPatients(prev => [...prev, patientId]);
    } else {
      setSelectedPatients(prev => prev.filter(id => id !== patientId));
      setSelectAll(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedPatients(patients.map(p => p.id));
    } else {
      setSelectedPatients([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPatients.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPatients.length} patient(s)?`)) return;

    try {
      const deletePromises = selectedPatients.map(id =>
        fetch(`/api/patients/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      setSelectedPatients([]);
      setSelectAll(false);
      fetchPatients();
    } catch (error) {
      console.error("Failed to delete patients:", error);
    }
  };

  const handleExport = () => {
    // Export selected patients or all patients if none selected
    const patientsToExport = selectedPatients.length > 0
      ? patients.filter(p => selectedPatients.includes(p.id))
      : patients;

    const csvContent = [
      ["UHID", "First Name", "Last Name", "Age", "Gender", "Phone", "Email", "Blood Group", "Status"],
      ...patientsToExport.map(p => [
        p.uhid,
        p.firstName,
        p.lastName,
        calculateAge(new Date(p.dateOfBirth)).toString(),
        getGenderDisplay(p.gender),
        p.phoneNumber,
        p.email || "",
        p.bloodGroup || "",
        p.status
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    // TODO: Implement import functionality
    alert("Import functionality will be implemented");
  };

  const handleDeletePatient = async (patientId: string) => {
    if (!confirm("Are you sure you want to delete this patient?")) return;

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPatients();
      }
    } catch (error) {
      console.error("Failed to delete patient:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const getGenderDisplay = (gender: string) => {
    switch (gender) {
      case "MALE":
        return "Male";
      case "FEMALE":
        return "Female";
      case "OTHER":
        return "Other";
      default:
        return gender;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedPatients.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedPatients.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={handleCreatePatient}>
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>UHID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading patients...
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No patients found
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedPatients.includes(patient.id)}
                      onCheckedChange={(checked) => handleCheckboxChange(patient.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{patient.uhid}</TableCell>
                  <TableCell>
                    {patient.firstName} {patient.lastName}
                  </TableCell>
                  <TableCell>
                    {calculateAge(new Date(patient.dateOfBirth))} years
                  </TableCell>
                  <TableCell>{getGenderDisplay(patient.gender)}</TableCell>
                  <TableCell>{patient.phoneNumber}</TableCell>
                  <TableCell>{getStatusBadge(patient.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSelectPatient(patient)}>
                          Select Patient
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditPatient(patient)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePatient(patient.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {patients.length} of {total} patients
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Drawers */}
      <PatientFormDrawer
        open={showFormDrawer}
        onClose={() => setShowFormDrawer(false)}
        patient={editingPatient}
        onSuccess={handleFormSuccess}
      />

      <PatientDetailsDrawer
        open={showDetailsDrawer}
        onClose={() => setShowDetailsDrawer(false)}
        patient={viewingPatient}
      />
    </div>
  );
}