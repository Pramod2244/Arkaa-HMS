"use client";

import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, User, Heart, FileText, Loader2, Crown, AlertTriangle, Siren, Calendar, Building, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/Drawer";
import { calculateAge } from "@/lib/utils/date-utils";
import { TITLE_CODES, BLOOD_GROUPS, RELATION_TYPES } from "@/lib/schemas/patient-registration-schema";

interface PatientFlag {
  flagType: string;
  notes?: string;
  isActive: boolean;
}

interface PatientRelation {
  relationType: string;
  relationName: string;
  relationMobile?: string;
}

interface PatientRegistration {
  id: string;
  registrationNumber: string;
  registrationDate: string;
  registrationFee: number;
  netAmount: number;
  paymentMode: string;
}

interface Patient {
  id: string;
  uhid: string;
  titleCode?: number;
  firstName: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageYears?: number;
  ageMonths?: number;
  ageDays?: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  maritalStatus?: string;
  primaryMobile?: string;
  phoneNumber?: string;
  secondaryMobile?: string;
  email?: string;
  guardianName?: string;
  guardianMobile?: string;
  presentHouseNo?: string;
  presentStreet?: string;
  presentArea?: string;
  presentVillage?: string;
  presentDistrict?: string;
  presentState?: string;
  presentPincode?: string;
  aadhaarNumber?: string;
  passportNumber?: string;
  panNumber?: string;
  bloodGroup?: string;
  motherTongue?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  occupation?: string;
  employerName?: string;
  corporateId?: string;
  employeeId?: string;
  isVip?: boolean;
  isMlc?: boolean;
  isEmergency?: boolean;
  allergies?: string;
  medicalHistory?: string;
  status: "ACTIVE" | "INACTIVE" | "DECEASED";
  createdAt: string;
  updatedAt: string;
  flags?: PatientFlag[];
  relations?: PatientRelation[];
  registrations?: PatientRegistration[];
}

interface PatientDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  patient?: Patient | null;
}

export function PatientDetailsDrawer({ open, onClose, patientId, patient: directPatient }: PatientDetailsDrawerProps) {
  const [patient, setPatient] = useState<Patient | null>(directPatient || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && patientId && !directPatient) {
      fetchPatient(patientId);
    } else if (directPatient) {
      setPatient(directPatient);
    }
  }, [open, patientId, directPatient]);

  const fetchPatient = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/patients/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setPatient(data.data);
      } else {
        setError(data.message || "Failed to load patient");
      }
    } catch (err) {
      console.error("Failed to fetch patient:", err);
      setError("Failed to load patient details");
    } finally {
      setLoading(false);
    }
  };

  const getFullName = () => {
    if (!patient) return "";
    const title = patient.titleCode ? TITLE_CODES[patient.titleCode as keyof typeof TITLE_CODES]?.label || "" : "";
    const parts = [title, patient.firstName, patient.middleName, patient.lastName].filter(Boolean);
    return parts.join(" ");
  };

  const getAge = () => {
    if (!patient) return "-";
    if (patient.ageYears !== undefined && patient.ageYears !== null) {
      const parts = [];
      if (patient.ageYears > 0) parts.push(`${patient.ageYears}Y`);
      if (patient.ageMonths && patient.ageMonths > 0) parts.push(`${patient.ageMonths}M`);
      if (patient.ageDays && patient.ageDays > 0 && patient.ageYears === 0) parts.push(`${patient.ageDays}D`);
      return parts.join(" ") || "0";
    }
    if (patient.dateOfBirth) {
      return `${calculateAge(new Date(patient.dateOfBirth))}Y`;
    }
    return "-";
  };

  const getMobile = () => patient?.primaryMobile || patient?.phoneNumber || "-";

  const getAddress = () => {
    if (!patient) return null;
    const parts = [
      patient.presentHouseNo,
      patient.presentStreet,
      patient.presentArea,
      patient.presentVillage,
      patient.presentDistrict,
      patient.presentState,
      patient.presentPincode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const getRelation = () => {
    const relation = patient?.relations?.[0];
    if (!relation) return null;
    const typeInfo = RELATION_TYPES.find(r => r.value === relation.relationType);
    return {
      type: typeInfo?.shortLabel || relation.relationType,
      name: relation.relationName,
    };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const footer = (
    <div className="flex justify-end gap-4">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  );

  if (loading) {
    return (
      <Drawer isOpen={open} onClose={onClose} title="Patient Details" footer={footer} width="w-2/5">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Drawer>
    );
  }

  if (error || !patient) {
    return (
      <Drawer isOpen={open} onClose={onClose} title="Patient Details" footer={footer} width="w-2/5">
        <div className="flex items-center justify-center h-64 text-gray-500">
          {error || "Patient not found"}
        </div>
      </Drawer>
    );
  }

  const relation = getRelation();
  const address = getAddress();

  return (
    <Drawer isOpen={open} onClose={onClose} title="Patient Details" footer={footer} width="w-2/5">
      <div className="space-y-6">
        {/* UHID & Status Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">UHID</div>
              <div className="text-xl font-mono font-bold text-blue-600">{patient.uhid}</div>
            </div>
            <div className="flex items-center gap-2">
              {(patient.isVip || patient.flags?.some(f => f.flagType === "VIP" && f.isActive)) && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  <Crown className="h-3 w-3 mr-1" /> VIP
                </Badge>
              )}
              {(patient.isMlc || patient.flags?.some(f => f.flagType === "MLC" && f.isActive)) && (
                <Badge className="bg-orange-100 text-orange-800">
                  <AlertTriangle className="h-3 w-3 mr-1" /> MLC
                </Badge>
              )}
              {(patient.isEmergency || patient.flags?.some(f => f.flagType === "EMERGENCY" && f.isActive)) && (
                <Badge className="bg-red-100 text-red-800">
                  <Siren className="h-3 w-3 mr-1" /> Emergency
                </Badge>
              )}
              <Badge variant={patient.status === "ACTIVE" ? "default" : "secondary"}>
                {patient.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
            <User className="h-5 w-5 text-gray-500" />
            Basic Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Full Name</div>
              <div className="font-medium">{getFullName()}</div>
              {relation && (
                <div className="text-sm text-gray-500">{relation.type} {relation.name}</div>
              )}
            </div>

            <div>
              <div className="text-sm text-gray-500">Age / Gender</div>
              <div className="font-medium">
                {getAge()} • {patient.gender}
              </div>
            </div>

            {patient.dateOfBirth && (
              <div>
                <div className="text-sm text-gray-500">Date of Birth</div>
                <div className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {formatDate(patient.dateOfBirth)}
                </div>
              </div>
            )}

            {patient.bloodGroup && (
              <div>
                <div className="text-sm text-gray-500">Blood Group</div>
                <div className="font-medium">
                  {BLOOD_GROUPS.find(b => b.value === patient.bloodGroup)?.label || patient.bloodGroup}
                </div>
              </div>
            )}

            {patient.maritalStatus && (
              <div>
                <div className="text-sm text-gray-500">Marital Status</div>
                <div className="font-medium capitalize">{patient.maritalStatus.toLowerCase()}</div>
              </div>
            )}

            {patient.nationality && (
              <div>
                <div className="text-sm text-gray-500">Nationality</div>
                <div className="font-medium">{patient.nationality}</div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
            <Phone className="h-5 w-5 text-gray-500" />
            Contact Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Primary Mobile</div>
              <div className="font-medium flex items-center gap-1">
                <Phone className="h-4 w-4 text-gray-400" />
                {getMobile()}
              </div>
            </div>

            {patient.secondaryMobile && (
              <div>
                <div className="text-sm text-gray-500">Secondary Mobile</div>
                <div className="font-medium">{patient.secondaryMobile}</div>
              </div>
            )}

            {patient.email && (
              <div className="col-span-2">
                <div className="text-sm text-gray-500">Email</div>
                <div className="font-medium flex items-center gap-1">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {patient.email}
                </div>
              </div>
            )}

            {patient.guardianName && (
              <div>
                <div className="text-sm text-gray-500">Guardian</div>
                <div className="font-medium">{patient.guardianName}</div>
                {patient.guardianMobile && (
                  <div className="text-sm text-gray-500">{patient.guardianMobile}</div>
                )}
              </div>
            )}
          </div>

          {address && (
            <div>
              <div className="text-sm text-gray-500">Address</div>
              <div className="font-medium flex items-start gap-1">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                {address}
              </div>
            </div>
          )}
        </div>

        {/* Identity Documents */}
        {(patient.aadhaarNumber || patient.passportNumber || patient.panNumber) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Identity Documents
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {patient.aadhaarNumber && (
                <div>
                  <div className="text-sm text-gray-500">Aadhaar</div>
                  <div className="font-mono">{patient.aadhaarNumber}</div>
                </div>
              )}
              {patient.panNumber && (
                <div>
                  <div className="text-sm text-gray-500">PAN</div>
                  <div className="font-mono">{patient.panNumber}</div>
                </div>
              )}
              {patient.passportNumber && (
                <div>
                  <div className="text-sm text-gray-500">Passport</div>
                  <div className="font-mono">{patient.passportNumber}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Professional Info */}
        {(patient.occupation || patient.employerName) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
              <Briefcase className="h-5 w-5 text-gray-500" />
              Professional
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {patient.occupation && (
                <div>
                  <div className="text-sm text-gray-500">Occupation</div>
                  <div className="font-medium">{patient.occupation}</div>
                </div>
              )}
              {patient.employerName && (
                <div>
                  <div className="text-sm text-gray-500">Employer</div>
                  <div className="font-medium flex items-center gap-1">
                    <Building className="h-4 w-4 text-gray-400" />
                    {patient.employerName}
                  </div>
                </div>
              )}
              {patient.employeeId && (
                <div>
                  <div className="text-sm text-gray-500">Employee ID</div>
                  <div className="font-medium">{patient.employeeId}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Info */}
        {(patient.allergies || patient.medicalHistory) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
              <Heart className="h-5 w-5 text-gray-500" />
              Medical Information
            </h3>

            {patient.allergies && (
              <div>
                <div className="text-sm text-gray-500">Allergies</div>
                <div className="font-medium text-red-600">{patient.allergies}</div>
              </div>
            )}

            {patient.medicalHistory && (
              <div>
                <div className="text-sm text-gray-500">Medical History</div>
                <div className="font-medium">{patient.medicalHistory}</div>
              </div>
            )}
          </div>
        )}

        {/* Registration History */}
        {patient.registrations && patient.registrations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 border-b pb-2">
              <FileText className="h-5 w-5 text-gray-500" />
              Registration History
            </h3>

            <div className="space-y-2">
              {patient.registrations.map((reg) => (
                <div key={reg.id} className="bg-gray-50 rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{reg.registrationNumber}</div>
                    <div className="text-xs text-gray-500">{formatDate(reg.registrationDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">₹{reg.netAmount}</div>
                    <div className="text-xs text-gray-500 capitalize">{reg.paymentMode?.toLowerCase()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created/Updated Info */}
        <div className="text-xs text-gray-400 pt-4 border-t">
          <div>Created: {formatDate(patient.createdAt)}</div>
          <div>Last Updated: {formatDate(patient.updatedAt)}</div>
        </div>
      </div>
    </Drawer>
  );
}
