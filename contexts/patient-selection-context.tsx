"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Patient {
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

export interface PatientSummary {
  lastVisitDate?: string;
  totalVisits: number;
  outstandingDues: number;
  lastVisitSummary?: string;
}

export interface PatientSearchResult extends Patient {
  summary: PatientSummary;
}

interface PatientSelectionContextType {
  selectedPatient: Patient | null;
  selectedPatientSummary: PatientSummary | null;
  setSelectedPatient: (patient: Patient | null, summary?: PatientSummary) => void;
  clearSelection: () => void;
  searchPatients: (query: string, searchBy: 'mobile' | 'uhid' | 'name') => Promise<PatientSearchResult[]>;
  isSearching: boolean;
}

const PatientSelectionContext = createContext<PatientSelectionContextType | undefined>(undefined);

export function PatientSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedPatient, setSelectedPatientState] = useState<Patient | null>(null);
  const [selectedPatientSummary, setSelectedPatientSummary] = useState<PatientSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const setSelectedPatient = (patient: Patient | null, summary?: PatientSummary) => {
    setSelectedPatientState(patient);
    setSelectedPatientSummary(summary || null);
  };

  const clearSelection = () => {
    setSelectedPatientState(null);
    setSelectedPatientSummary(null);
  };

  const searchPatients = async (
    query: string,
    searchBy: 'mobile' | 'uhid' | 'name'
  ): Promise<PatientSearchResult[]> => {
    if (!query.trim()) return [];

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        query: query.trim(),
        searchBy,
        includeSummary: 'true',
      });

      const response = await fetch(`/api/patients/search?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Patient search error:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <PatientSelectionContext.Provider
      value={{
        selectedPatient,
        selectedPatientSummary,
        setSelectedPatient,
        clearSelection,
        searchPatients,
        isSearching,
      }}
    >
      {children}
    </PatientSelectionContext.Provider>
  );
}

export function usePatientSelection() {
  const context = useContext(PatientSelectionContext);
  if (context === undefined) {
    throw new Error("usePatientSelection must be used within a PatientSelectionProvider");
  }
  return context;
}