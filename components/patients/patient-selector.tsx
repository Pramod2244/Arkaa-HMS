"use client";

import { useState, useEffect } from "react";
import { Search, User, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePatientSelection, PatientSearchResult } from "@/contexts/patient-selection-context";
import { calculateAge } from "@/lib/utils/date-utils";

interface PatientSelectorProps {
  trigger?: React.ReactNode;
  onPatientSelect?: (patient: PatientSearchResult) => void;
}

export function PatientSelector({ trigger, onPatientSelect }: PatientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBy, setSearchBy] = useState<'mobile' | 'uhid' | 'name'>('mobile');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const { searchPatients, isSearching, selectedPatient, setSelectedPatient } = usePatientSelection();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const results = await searchPatients(searchQuery, searchBy);
    setSearchResults(results);
  };

  const handlePatientSelect = (patient: PatientSearchResult) => {
    setSelectedPatient(patient, patient.summary);
    onPatientSelect?.(patient);
    setOpen(false);
  };

  const getGenderDisplay = (gender: string) => {
    switch (gender) {
      case "MALE": return "Male";
      case "FEMALE": return "Female";
      case "OTHER": return "Other";
      default: return gender;
    }
  };

  const defaultTrigger = (
    <Button variant="outline" className="w-full justify-start">
      <User className="h-4 w-4 mr-2" />
      {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.uhid})` : "Select Patient"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Patient</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Controls */}
          <div className="flex gap-2">
            <Select value={searchBy} onValueChange={(value: any) => setSearchBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="uhid">UHID</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={`Search by ${searchBy}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>

            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchQuery ? "No patients found" : "Enter search criteria to find patients"}
              </div>
            ) : (
              <div className="divide-y">
                {searchResults.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {patient.uhid}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{calculateAge(new Date(patient.dateOfBirth))} years</span>
                          <span>{getGenderDisplay(patient.gender)}</span>
                          <span>{patient.phoneNumber}</span>
                        </div>

                        {patient.summary && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {patient.summary.lastVisitDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Last visit: {new Date(patient.summary.lastVisitDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{patient.summary.totalVisits} visits</span>
                            </div>
                            {patient.summary.outstandingDues > 0 && (
                              <div className="flex items-center gap-1 text-red-600">
                                <DollarSign className="h-3 w-3" />
                                <span>₹{patient.summary.outstandingDues.toFixed(2)} due</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <Button size="sm" variant="outline">
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Patient Info */}
          {selectedPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Currently Selected Patient</h4>
              <div className="text-sm text-blue-800">
                <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p>UHID: {selectedPatient.uhid} • Phone: {selectedPatient.phoneNumber}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}