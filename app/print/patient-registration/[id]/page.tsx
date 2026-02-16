"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

// Code128 Barcode Generator
function generateCode128Barcode(data: string): string {
  // Code128 character set B (ASCII 32-127)
  const CODE128B = [
    " ", "!", '"', "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
    "@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[", "\\", "]", "^", "_",
    "`", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
    "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "{", "|", "}", "~"
  ];

  // Code128 bar patterns
  const PATTERNS = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
    "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
    "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
    "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
    "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
    "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
    "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
    "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
    "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
    "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
    "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
    "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
    "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
    "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
    "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
    "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
    "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
    "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
    "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
    "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
    "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
    "11010011100"
  ];

  const START_B = 104;
  const STOP = "1100011101011";

  let checksum = START_B;
  let barcode = PATTERNS[START_B];

  for (let i = 0; i < data.length; i++) {
    const charIndex = CODE128B.indexOf(data[i]);
    if (charIndex >= 0) {
      barcode += PATTERNS[charIndex];
      checksum += (i + 1) * charIndex;
    }
  }

  checksum = checksum % 103;
  barcode += PATTERNS[checksum];
  barcode += STOP;

  return barcode;
}

// Barcode Component
function Barcode({ value, height = 40 }: { value: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pattern = generateCode128Barcode(value);
    const barWidth = 2;
    const width = pattern.length * barWidth;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === "1") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(i * barWidth, 0, barWidth, height);
      }
    }
  }, [value, height]);

  return <canvas ref={canvasRef} className="mx-auto" />;
}

interface PatientData {
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
  gender: string;
  bloodGroup?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  idType?: string;
  idNumber?: string;
  photo?: string;
  createdAt: string;
  registeredBy?: {
    id: string;
    fullName: string;
  };
  approvedBy?: {
    id: string;
    fullName: string;
  };
  registrations?: Array<{
    id: string;
    registrationNumber: string;
    registrationDate: string;
    registrationFee?: number;
    discount?: number;
    amountPaid?: number;
    paymentMode?: string;
  }>;
  tenant?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
  };
}

const TITLE_MAP: Record<number, string> = {
  1: "Mr.",
  2: "Mrs.",
  3: "Ms.",
  4: "Master",
  5: "Baby",
  6: "Dr.",
};

const BLOOD_GROUP_MAP: Record<string, string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
};

export default function PatientRegistrationPrintPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPatient() {
      try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch patient details");
        }
        const data = await response.json();
        setPatient(data.data || data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (patientId) {
      fetchPatient();
    }
  }, [patientId]);

  useEffect(() => {
    // Auto-print when patient data is loaded
    if (patient && !loading) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [patient, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error || "Patient not found"}</p>
        </div>
      </div>
    );
  }

  const getFullName = () => {
    const title = patient.titleCode ? TITLE_MAP[patient.titleCode] : "";
    return [title, patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .join(" ");
  };

  const getAge = () => {
    if (patient.ageYears || patient.ageMonths || patient.ageDays) {
      const parts = [];
      if (patient.ageYears) parts.push(`${patient.ageYears}Y`);
      if (patient.ageMonths) parts.push(`${patient.ageMonths}M`);
      if (patient.ageDays) parts.push(`${patient.ageDays}D`);
      return parts.join(" ");
    }
    if (patient.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth);
      const today = new Date();
      const years = today.getFullYear() - dob.getFullYear();
      return `${years} Years`;
    }
    return "-";
  };

  const getAddress = () => {
    return [patient.address, patient.city, patient.state, patient.pincode]
      .filter(Boolean)
      .join(", ");
  };

  const latestRegistration = patient.registrations?.[0];

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto bg-white p-6 print:p-0">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {patient.tenant?.logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={patient.tenant.logo}
                  alt="Hospital Logo"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">H</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {patient.tenant?.name || "Hospital Management System"}
                </h1>
                {patient.tenant?.address && (
                  <p className="text-sm text-gray-600">{patient.tenant.address}</p>
                )}
                <div className="flex gap-4 text-xs text-gray-500 mt-1">
                  {patient.tenant?.phone && <span>Tel: {patient.tenant.phone}</span>}
                  {patient.tenant?.email && <span>Email: {patient.tenant.email}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-semibold text-gray-800">PATIENT REGISTRATION</h2>
              <p className="text-sm text-gray-600">
                Date: {new Date(patient.createdAt).toLocaleDateString("en-IN")}
              </p>
              {latestRegistration && (
                <p className="text-sm text-gray-600">
                  Reg. No: {latestRegistration.registrationNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* UHID Section with Barcode */}
        <div className="flex justify-between items-start mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 inline-block">
            <p className="text-xs text-blue-600 font-medium">UHID (Unique Health ID)</p>
            <p className="text-2xl font-bold text-blue-800">{patient.uhid}</p>
          </div>
          <div className="text-center">
            <Barcode value={patient.uhid} height={50} />
            <p className="text-xs text-gray-500 mt-1">{patient.uhid}</p>
          </div>
        </div>

        {/* Patient Details Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Photo */}
          <div className="row-span-3 flex flex-col items-center">
            {patient.photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={patient.photo}
                alt="Patient Photo"
                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <span className="text-4xl text-gray-400">👤</span>
              </div>
            )}
            <p className="mt-2 text-sm font-medium text-gray-700">{getFullName()}</p>
          </div>

          {/* Basic Info */}
          <div className="col-span-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Patient Name</p>
              <p className="font-medium">{getFullName()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Gender</p>
              <p className="font-medium">{patient.gender}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Age</p>
              <p className="font-medium">{getAge()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Date of Birth</p>
              <p className="font-medium">
                {patient.dateOfBirth
                  ? new Date(patient.dateOfBirth).toLocaleDateString("en-IN")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Blood Group</p>
              <p className="font-medium">
                {patient.bloodGroup
                  ? BLOOD_GROUP_MAP[patient.bloodGroup] || patient.bloodGroup
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Mobile</p>
              <p className="font-medium">{patient.mobile || "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 text-xs">Email</p>
              <p className="font-medium">{patient.email || "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500 text-xs">Address</p>
              <p className="font-medium">{getAddress() || "-"}</p>
            </div>
          </div>
        </div>

        {/* ID Document */}
        {patient.idType && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Identity Document</p>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type: </span>
                <span className="font-medium">{patient.idType}</span>
              </div>
              <div>
                <span className="text-gray-600">Number: </span>
                <span className="font-medium">{patient.idNumber}</span>
              </div>
            </div>
          </div>
        )}

        {/* Registration Details */}
        {latestRegistration && (
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b">
              <p className="text-sm font-medium text-gray-700">Registration Details</p>
            </div>
            <div className="grid grid-cols-4 gap-4 p-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Registration Fee</p>
                <p className="font-medium">
                  ₹{latestRegistration.registrationFee?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Discount</p>
                <p className="font-medium">
                  ₹{latestRegistration.discount?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Amount Paid</p>
                <p className="font-medium">
                  ₹{latestRegistration.amountPaid?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Payment Mode</p>
                <p className="font-medium">{latestRegistration.paymentMode || "-"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer with Registered/Approved By */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Registered By</p>
              <p className="font-medium">{patient.registeredBy?.fullName || "-"}</p>
              <p className="text-xs text-gray-500">
                {new Date(patient.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Approved By</p>
              <p className="font-medium">{patient.approvedBy?.fullName || "-"}</p>
            </div>
          </div>
        </div>

        {/* Print Instructions (non-print) */}
        <div className="mt-8 text-center no-print">
          <p className="text-sm text-gray-500 mb-2">
            This page will automatically print. If it doesn&apos;t, click the button below.
          </p>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Print Registration
          </button>
          <button
            onClick={() => window.close()}
            className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>

        {/* Barcode at Bottom */}
        <div className="mt-6 pt-4 border-t text-center">
          <Barcode value={patient.uhid} height={30} />
          <p className="text-xs text-gray-400 mt-1">{patient.uhid}</p>
        </div>
      </div>
    </>
  );
}
