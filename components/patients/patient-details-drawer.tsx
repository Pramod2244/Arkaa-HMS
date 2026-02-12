"use client";

import { X, Phone, Mail, MapPin, User, Heart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/Drawer";
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
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE";
  allergies?: string;
  medicalHistory?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

interface PatientDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const bloodGroupLabels: Record<string, string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
};

export function PatientDetailsDrawer({ open, onClose, patient }: PatientDetailsDrawerProps) {
  if (!patient) return null;

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

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Patient Details"
      footer={footer}
      width="w-2/5"
    >
      <div className="space-y-6">
        {/* UHID */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">UHID</div>
          <div className="text-lg font-mono font-semibold">{patient.uhid}</div>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Full Name</div>
              <div className="font-medium">
                {patient.firstName} {patient.lastName}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Age & Gender</div>
              <div className="font-medium">
                {calculateAge(new Date(patient.dateOfBirth))} years • {getGenderDisplay(patient.gender)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Date of Birth</div>
              <div className="font-medium">{formatDate(patient.dateOfBirth)}</div>
            </div>

            {patient.bloodGroup && (
              <div>
                <div className="text-sm text-gray-600">Blood Group</div>
                <div className="font-medium">{bloodGroupLabels[patient.bloodGroup]}</div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Phone Number</div>
                <div className="font-medium">{patient.phoneNumber}</div>
              </div>
            </div>

            {patient.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="font-medium">{patient.email}</div>
                </div>
              </div>
            )}

            {patient.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <div className="text-sm text-gray-600">Address</div>
                  <div className="font-medium">{patient.address}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        {(patient.emergencyContactName || patient.emergencyContactPhone) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="h-5 w-5" />
              Emergency Contact
            </h3>

            <div className="space-y-3">
              {patient.emergencyContactName && (
                <div>
                  <div className="text-sm text-gray-600">Contact Name</div>
                  <div className="font-medium">{patient.emergencyContactName}</div>
                </div>
              )}

              {patient.emergencyContactPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-600">Contact Phone</div>
                    <div className="font-medium">{patient.emergencyContactPhone}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Medical Information
          </h3>

          <div className="space-y-4">
            {patient.allergies && (
              <div>
                <div className="text-sm text-gray-600 mb-2">Allergies</div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm">{patient.allergies}</div>
                </div>
              </div>
            )}

            {patient.medicalHistory && (
              <div>
                <div className="text-sm text-gray-600 mb-2">Medical History</div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm whitespace-pre-wrap">{patient.medicalHistory}</div>
                </div>
              </div>
            )}

            {!patient.allergies && !patient.medicalHistory && (
              <div className="text-sm text-gray-500 italic">
                No medical information recorded
              </div>
            )}
          </div>
        </div>

        {/* Registration Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registration Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Registered On</div>
              <div className="font-medium">{formatDate(patient.createdAt)}</div>
            </div>

            <div>
              <div className="text-gray-600">Last Updated</div>
              <div className="font-medium">{formatDate(patient.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}