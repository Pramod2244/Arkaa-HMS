"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  Activity,
  FileText,
  Pill,
  FlaskConical,
  AlertTriangle,
  X,
  ArrowLeft,
} from "lucide-react";
import type { ConsultationContext } from "@/lib/services/consultation-context";

// ============== TYPES ==============

interface PrescriptionItem {
  id?: string;
  medicineName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing?: string;
  instructions?: string;
  quantity?: number;
}

interface LabOrderItem {
  id?: string;
  testName: string;
  testCode?: string;
  category?: string;
  priority: string;
  notes?: string;
}

interface VitalsData {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  temperature?: number;
  temperatureUnit?: string;
  spO2?: number;
  weight?: number;
  weightUnit?: string;
  height?: number;
  heightUnit?: string;
  respiratoryRate?: number;
  notes?: string;
}

interface NotesData {
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  physicalExamination?: string;
  diagnosis?: string;
  notes?: string;
}

// ============== MAIN COMPONENT ==============

interface ConsultationScreenProps {
  visitId: string;
}

export function ConsultationScreen({ visitId }: ConsultationScreenProps) {
  const router = useRouter();
  
  // State
  const [context, setContext] = useState<ConsultationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [vitals, setVitals] = useState<VitalsData>({});
  const [notes, setNotes] = useState<NotesData>({ chiefComplaint: "" });
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [followUpAdvice, setFollowUpAdvice] = useState("");
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>([]);
  
  // UI states
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [activeSection, setActiveSection] = useState<"vitals" | "notes" | "labs">("vitals");
  
  // Autosave timer
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ============== DATA LOADING ==============

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/consultation/context?visitId=${visitId}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to load consultation");
        return;
      }

      const ctx = result.data as ConsultationContext;
      setContext(ctx);

      // Initialize form states from context
      if (ctx.draft) {
        // Restore from draft
        if (ctx.draft.notesData) {
          setNotes(ctx.draft.notesData as NotesData);
        }
        if (ctx.draft.prescriptionData) {
          setDiagnosis(ctx.draft.prescriptionData.diagnosis || "");
          setFollowUpAdvice(ctx.draft.prescriptionData.followUpAdvice || "");
          setPrescriptionItems(ctx.draft.prescriptionData.items || []);
        }
        if (ctx.draft.labOrdersData) {
          setLabOrders(ctx.draft.labOrdersData as LabOrderItem[]);
        }
      } else {
        // Initialize from existing data
        if (ctx.consultation) {
          setNotes({
            chiefComplaint: ctx.consultation.chiefComplaint || "",
            historyOfPresentIllness: ctx.consultation.historyOfPresentIllness || "",
            physicalExamination: ctx.consultation.physicalExamination || "",
            diagnosis: ctx.consultation.diagnosis || "",
            notes: ctx.consultation.notes || "",
          });
          setDiagnosis(ctx.consultation.diagnosis || "");
          setFollowUpAdvice(ctx.consultation.followUpPlan || "");
        }
        if (ctx.prescription) {
          setPrescriptionItems(ctx.prescription.items);
        }
      }
    } catch (err) {
      setError("Failed to load consultation data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // ============== AUTOSAVE ==============

  const saveDraft = useCallback(async () => {
    if (!context?.canEdit) return;

    try {
      await fetch("/api/consultation/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId,
          notesData: notes,
          prescriptionData: {
            diagnosis,
            followUpAdvice,
            items: prescriptionItems,
          },
          labOrdersData: labOrders,
        }),
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  }, [visitId, notes, diagnosis, followUpAdvice, prescriptionItems, labOrders, context?.canEdit]);

  // Autosave effect
  useEffect(() => {
    if (!context?.canEdit) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 10000); // 10 seconds

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [notes, diagnosis, followUpAdvice, prescriptionItems, labOrders, saveDraft, context?.canEdit]);

  // ============== API CALLS ==============

  const saveVitals = async () => {
    if (!context?.canEdit) return;
    setSaving(true);
    try {
      const response = await fetch("/api/consultation/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, ...vitals }),
      });
      const result = await response.json();
      if (result.success) {
        await loadContext(); // Refresh data
        setVitals({}); // Clear form
      } else {
        alert(result.error || "Failed to save vitals");
      }
    } catch {
      alert("Failed to save vitals");
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!context?.canEdit) return;
    if (!notes.chiefComplaint) {
      alert("Chief complaint is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/consultation/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, ...notes, diagnosis }),
      });
      const result = await response.json();
      if (result.success) {
        await loadContext();
      } else {
        alert(result.error || "Failed to save notes");
      }
    } catch {
      alert("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const savePrescription = async () => {
    if (!context?.canEdit) return;
    if (!diagnosis) {
      alert("Diagnosis is required");
      return;
    }
    if (prescriptionItems.length === 0) {
      alert("At least one medicine is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/consultation/prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId,
          diagnosis,
          followUpAdvice,
          items: prescriptionItems,
        }),
      });
      const result = await response.json();
      if (result.success) {
        await loadContext();
      } else {
        alert(result.error || "Failed to save prescription");
      }
    } catch {
      alert("Failed to save prescription");
    } finally {
      setSaving(false);
    }
  };

  const saveLabOrders = async () => {
    if (!context?.canEdit) return;
    if (labOrders.length === 0) {
      alert("At least one lab test is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/consultation/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitId,
          items: labOrders,
        }),
      });
      const result = await response.json();
      if (result.success) {
        await loadContext();
        setLabOrders([]);
      } else {
        alert(result.error || "Failed to save lab orders");
      }
    } catch {
      alert("Failed to save lab orders");
    } finally {
      setSaving(false);
    }
  };

  const completeVisit = async () => {
    if (!context?.canEdit) return;
    
    if (!confirm("Are you sure you want to complete this visit? No further edits will be allowed.")) {
      return;
    }

    setCompleting(true);
    try {
      const response = await fetch("/api/consultation/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
      });
      const result = await response.json();
      if (result.success) {
        await loadContext();
        alert("Visit completed successfully");
      } else {
        alert(result.error || "Failed to complete visit");
      }
    } catch {
      alert("Failed to complete visit");
    } finally {
      setCompleting(false);
    }
  };

  // ============== PRESCRIPTION HANDLERS ==============

  const addPrescriptionItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        medicineName: "",
        dosage: "",
        frequency: "",
        duration: "",
        dosageForm: "tablet",
      },
    ]);
  };

  const updatePrescriptionItem = (index: number, field: keyof PrescriptionItem, value: string | number) => {
    const updated = [...prescriptionItems];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptionItems(updated);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  // ============== LAB ORDER HANDLERS ==============

  const addLabOrder = () => {
    setLabOrders([
      ...labOrders,
      { testName: "", priority: "NORMAL" },
    ]);
  };

  const updateLabOrder = (index: number, field: keyof LabOrderItem, value: string) => {
    const updated = [...labOrders];
    updated[index] = { ...updated[index], [field]: value };
    setLabOrders(updated);
  };

  const removeLabOrder = (index: number) => {
    setLabOrders(labOrders.filter((_, i) => i !== index));
  };

  // ============== RENDER ==============

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading consultation...</span>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">{error || "Failed to load consultation"}</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  // Extract context - consultation is available for future use but currently used for notes initialization
  const { patient, visit, vitals: existingVitals, prescription, labOrders: existingLabOrders, pastVisits, lastPrescription, isLocked, canEdit } = context;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/doctor/dashboard")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Doctor Consultation</h1>
          <Badge variant={visit.status === "COMPLETED" ? "default" : visit.status === "IN_PROGRESS" ? "secondary" : "outline"}>
            {visit.status}
          </Badge>
          {isLocked && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Locked
            </Badge>
          )}
          {draftSaved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Draft saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                Save Draft
              </Button>
              <Button size="sm" onClick={completeVisit} disabled={completing || saving}>
                {completing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Complete Visit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content - Three Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL - Patient & Visit Context */}
        <div className="w-72 border-r bg-white overflow-y-auto">
          <PatientContextPanel
            patient={patient}
            visit={visit}
            pastVisits={pastVisits}
            lastPrescription={lastPrescription}
          />
        </div>

        {/* CENTER PANEL - Prescription (Primary) */}
        <div className="flex-1 overflow-y-auto p-4">
          <PrescriptionPanel
            diagnosis={diagnosis}
            setDiagnosis={setDiagnosis}
            followUpAdvice={followUpAdvice}
            setFollowUpAdvice={setFollowUpAdvice}
            items={prescriptionItems}
            onAddItem={addPrescriptionItem}
            onUpdateItem={updatePrescriptionItem}
            onRemoveItem={removePrescriptionItem}
            onSave={savePrescription}
            saving={saving}
            canEdit={canEdit}
            existingPrescription={prescription}
          />
        </div>

        {/* RIGHT PANEL - Vitals, Notes, Labs */}
        <div className="w-96 border-l bg-white overflow-y-auto">
          <RightPanel
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            // Vitals
            vitals={vitals}
            setVitals={setVitals}
            existingVitals={existingVitals}
            onSaveVitals={saveVitals}
            // Notes
            notes={notes}
            setNotes={setNotes}
            onSaveNotes={saveNotes}
            // Labs
            labOrders={labOrders}
            existingLabOrders={existingLabOrders}
            onAddLabOrder={addLabOrder}
            onUpdateLabOrder={updateLabOrder}
            onRemoveLabOrder={removeLabOrder}
            onSaveLabOrders={saveLabOrders}
            // Common
            saving={saving}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}

// ============== SUB COMPONENTS ==============

function PatientContextPanel({
  patient,
  visit,
  pastVisits,
  lastPrescription,
}: {
  patient: ConsultationContext["patient"];
  visit: ConsultationContext["visit"];
  pastVisits: ConsultationContext["pastVisits"];
  lastPrescription: ConsultationContext["lastPrescription"];
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Patient Info */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Patient</h2>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-lg">{patient.fullName}</p>
          <p className="text-muted-foreground">
            {patient.age} yrs • {patient.gender}
          </p>
          <p className="text-muted-foreground">UHID: {patient.uhid}</p>
          <p className="text-muted-foreground">{patient.phoneNumber}</p>
          {patient.bloodGroup && (
            <Badge variant="outline" className="mt-1">
              {patient.bloodGroup.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>

      {/* Allergies */}
      {patient.allergies && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            ALLERGIES
          </p>
          <p className="text-sm text-red-800 mt-1">{patient.allergies}</p>
        </div>
      )}

      {/* Medical History */}
      {patient.medicalHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700">CHRONIC CONDITIONS</p>
          <p className="text-sm text-amber-800 mt-1">{patient.medicalHistory}</p>
        </div>
      )}

      {/* Visit Info */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Current Visit</h2>
        </div>
        <div className="space-y-1 text-sm">
          <p>Visit #{visit.visitNumber}</p>
          <p className="text-muted-foreground">
            {new Date(visit.createdAt).toLocaleDateString()} {" "}
            {visit.checkInTime && new Date(visit.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {visit.department && <p className="text-muted-foreground">{visit.department.name}</p>}
          {visit.doctor && <p className="text-muted-foreground">Dr. {visit.doctor.fullName}</p>}
          <Badge variant={visit.priority === "EMERGENCY" ? "destructive" : visit.priority === "URGENT" ? "secondary" : "outline"}>
            {visit.priority}
          </Badge>
        </div>
      </div>

      {/* Past Visits */}
      {pastVisits.length > 0 && (
        <div className="border-t pt-4">
          <h2 className="font-semibold mb-2">Past Visits</h2>
          <div className="space-y-2">
            {pastVisits.map((pv) => (
              <div key={pv.id} className="text-sm border-l-2 border-gray-200 pl-2">
                <p className="text-muted-foreground">
                  {new Date(pv.visitDate).toLocaleDateString()}
                </p>
                {pv.diagnosis && <p className="truncate">{pv.diagnosis}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Prescription */}
      {lastPrescription && (
        <div className="border-t pt-4">
          <h2 className="font-semibold mb-2">Last Prescription</h2>
          <div className="text-sm">
            <p className="text-muted-foreground">
              {new Date(lastPrescription.prescriptionDate).toLocaleDateString()}
            </p>
            {lastPrescription.diagnosis && (
              <p className="truncate mb-1">{lastPrescription.diagnosis}</p>
            )}
            <div className="space-y-1">
              {lastPrescription.items.slice(0, 3).map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground truncate">
                  • {item.medicineName} - {item.dosage} {item.frequency}
                </p>
              ))}
              {lastPrescription.itemCount > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{lastPrescription.itemCount - 3} more
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrescriptionPanel({
  diagnosis,
  setDiagnosis,
  followUpAdvice,
  setFollowUpAdvice,
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSave,
  saving,
  canEdit,
  existingPrescription,
}: {
  diagnosis: string;
  setDiagnosis: (v: string) => void;
  followUpAdvice: string;
  setFollowUpAdvice: (v: string) => void;
  items: PrescriptionItem[];
  onAddItem: () => void;
  onUpdateItem: (index: number, field: keyof PrescriptionItem, value: string | number) => void;
  onRemoveItem: (index: number) => void;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
  existingPrescription: ConsultationContext["prescription"];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Prescription
          </CardTitle>
          {canEdit && (
            <Button onClick={onSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Diagnosis */}
        <div>
          <Label htmlFor="diagnosis" className="text-sm font-medium">
            Diagnosis <span className="text-red-500">*</span>
          </Label>
          <Input
            id="diagnosis"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Enter diagnosis"
            disabled={!canEdit}
            className="mt-1"
          />
        </div>

        {/* Follow-up Advice */}
        <div>
          <Label htmlFor="followup" className="text-sm font-medium">
            Follow-up Advice
          </Label>
          <Textarea
            id="followup"
            value={followUpAdvice}
            onChange={(e) => setFollowUpAdvice(e.target.value)}
            placeholder="Review after 7 days..."
            rows={2}
            disabled={!canEdit}
            className="mt-1"
          />
        </div>

        {/* Medicines Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Medicines</Label>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Medicine
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No medicines added</p>
              {canEdit && (
                <Button variant="link" onClick={onAddItem} className="mt-2">
                  Add first medicine
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <PrescriptionItemRow
                  key={index}
                  index={index}
                  item={item}
                  onUpdate={onUpdateItem}
                  onRemove={onRemoveItem}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>

        {/* Saved Prescription Display */}
        {existingPrescription && existingPrescription.items.length > 0 && items.length === 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Saved Prescription</p>
            <div className="space-y-2">
              {existingPrescription.items.map((item) => (
                <div key={item.id} className="text-sm bg-gray-50 p-2 rounded">
                  <p className="font-medium">{item.medicineName} {item.strength}</p>
                  <p className="text-muted-foreground">
                    {item.dosage} • {item.frequency} • {item.duration}
                    {item.timing && ` • ${item.timing}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrescriptionItemRow({
  index,
  item,
  onUpdate,
  onRemove,
  canEdit,
}: {
  index: number;
  item: PrescriptionItem;
  onUpdate: (index: number, field: keyof PrescriptionItem, value: string | number) => void;
  onRemove: (index: number) => void;
  canEdit: boolean;
}) {
  interface MedicineSuggestion {
    id: string;
    brandName: string;
    genericName?: string;
    strength?: string;
    dosageForm?: string;
    defaultDosage?: string;
    defaultFrequency?: string;
    defaultDuration?: string;
    defaultTiming?: string;
    source?: string;
    usageCount?: number;
  }

  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchMedicines = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/consultation/medicines/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error("Failed to search medicines:", err);
    }
  };

  const handleMedicineNameChange = (value: string) => {
    onUpdate(index, "medicineName", value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchMedicines(value);
    }, 300);
  };

  const selectSuggestion = (suggestion: MedicineSuggestion) => {
    onUpdate(index, "medicineName", suggestion.brandName);
    onUpdate(index, "genericName", suggestion.genericName || "");
    onUpdate(index, "strength", suggestion.strength || "");
    onUpdate(index, "dosageForm", suggestion.dosageForm || "tablet");
    onUpdate(index, "dosage", suggestion.defaultDosage || "1");
    onUpdate(index, "frequency", suggestion.defaultFrequency || "twice daily");
    onUpdate(index, "duration", suggestion.defaultDuration || "5 days");
    onUpdate(index, "timing", suggestion.defaultTiming || "");
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="border rounded-lg p-3 bg-gray-50 relative">
      <div className="grid grid-cols-12 gap-2">
        {/* Medicine Name with Auto-suggest */}
        <div className="col-span-4 relative">
          <Input
            value={item.medicineName}
            onChange={(e) => handleMedicineNameChange(e.target.value)}
            onFocus={() => item.medicineName.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Medicine name"
            disabled={!canEdit}
            className="text-sm"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onMouseDown={() => selectSuggestion(s)}
                >
                  <p className="font-medium">{s.brandName} {s.strength}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.genericName} • {s.dosageForm}
                    {s.source === "doctor_favorite" && (
                      <Badge variant="secondary" className="ml-1 text-xs">Frequently used</Badge>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Strength */}
        <div className="col-span-1">
          <Input
            value={item.strength || ""}
            onChange={(e) => onUpdate(index, "strength", e.target.value)}
            placeholder="Strength"
            disabled={!canEdit}
            className="text-sm"
          />
        </div>

        {/* Dosage */}
        <div className="col-span-1">
          <Input
            value={item.dosage}
            onChange={(e) => onUpdate(index, "dosage", e.target.value)}
            placeholder="Dosage"
            disabled={!canEdit}
            className="text-sm"
          />
        </div>

        {/* Frequency */}
        <div className="col-span-2">
          <Select
            value={item.frequency}
            onValueChange={(v) => onUpdate(index, "frequency", v)}
            disabled={!canEdit}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once daily">Once daily</SelectItem>
              <SelectItem value="twice daily">Twice daily</SelectItem>
              <SelectItem value="thrice daily">Thrice daily</SelectItem>
              <SelectItem value="four times daily">Four times daily</SelectItem>
              <SelectItem value="every 8 hours">Every 8 hours</SelectItem>
              <SelectItem value="every 6 hours">Every 6 hours</SelectItem>
              <SelectItem value="as needed">As needed</SelectItem>
              <SelectItem value="at bedtime">At bedtime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Duration */}
        <div className="col-span-2">
          <Input
            value={item.duration}
            onChange={(e) => onUpdate(index, "duration", e.target.value)}
            placeholder="e.g., 5 days"
            disabled={!canEdit}
            className="text-sm"
          />
        </div>

        {/* Timing */}
        <div className="col-span-1">
          <Select
            value={item.timing || ""}
            onValueChange={(v) => onUpdate(index, "timing", v)}
            disabled={!canEdit}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Timing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before food">Before food</SelectItem>
              <SelectItem value="after food">After food</SelectItem>
              <SelectItem value="with food">With food</SelectItem>
              <SelectItem value="empty stomach">Empty stomach</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Remove Button */}
        <div className="col-span-1 flex items-center justify-end">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-2">
        <Input
          value={item.instructions || ""}
          onChange={(e) => onUpdate(index, "instructions", e.target.value)}
          placeholder="Special instructions (optional)"
          disabled={!canEdit}
          className="text-sm"
        />
      </div>
    </div>
  );
}

function RightPanel({
  activeSection,
  setActiveSection,
  vitals,
  setVitals,
  existingVitals,
  onSaveVitals,
  notes,
  setNotes,
  onSaveNotes,
  labOrders,
  existingLabOrders,
  onAddLabOrder,
  onUpdateLabOrder,
  onRemoveLabOrder,
  onSaveLabOrders,
  saving,
  canEdit,
}: {
  activeSection: "vitals" | "notes" | "labs";
  setActiveSection: (s: "vitals" | "notes" | "labs") => void;
  vitals: VitalsData;
  setVitals: (v: VitalsData) => void;
  existingVitals: ConsultationContext["vitals"];
  onSaveVitals: () => void;
  notes: NotesData;
  setNotes: (n: NotesData) => void;
  onSaveNotes: () => void;
  labOrders: LabOrderItem[];
  existingLabOrders: ConsultationContext["labOrders"];
  onAddLabOrder: () => void;
  onUpdateLabOrder: (index: number, field: keyof LabOrderItem, value: string) => void;
  onRemoveLabOrder: (index: number) => void;
  onSaveLabOrders: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Section Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeSection === "vitals" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveSection("vitals")}
        >
          <Activity className="h-4 w-4 inline mr-1" />
          Vitals
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeSection === "notes" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveSection("notes")}
        >
          <FileText className="h-4 w-4 inline mr-1" />
          Notes
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeSection === "labs" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveSection("labs")}
        >
          <FlaskConical className="h-4 w-4 inline mr-1" />
          Labs
        </button>
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === "vitals" && (
          <VitalsSection
            vitals={vitals}
            setVitals={setVitals}
            existingVitals={existingVitals}
            onSave={onSaveVitals}
            saving={saving}
            canEdit={canEdit}
          />
        )}
        {activeSection === "notes" && (
          <NotesSection
            notes={notes}
            setNotes={setNotes}
            onSave={onSaveNotes}
            saving={saving}
            canEdit={canEdit}
          />
        )}
        {activeSection === "labs" && (
          <LabsSection
            labOrders={labOrders}
            existingLabOrders={existingLabOrders}
            onAddLabOrder={onAddLabOrder}
            onUpdateLabOrder={onUpdateLabOrder}
            onRemoveLabOrder={onRemoveLabOrder}
            onSave={onSaveLabOrders}
            saving={saving}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

function VitalsSection({
  vitals,
  setVitals,
  existingVitals,
  onSave,
  saving,
  canEdit,
}: {
  vitals: VitalsData;
  setVitals: (v: VitalsData) => void;
  existingVitals: ConsultationContext["vitals"];
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  const updateVital = (field: keyof VitalsData, value: number | string | undefined) => {
    setVitals({ ...vitals, [field]: value });
  };

  // Calculate BMI
  const calculateBMI = () => {
    if (vitals.weight && vitals.height) {
      const weightKg = vitals.weightUnit === "lbs" ? vitals.weight * 0.453592 : vitals.weight;
      const heightM = vitals.heightUnit === "inches" ? vitals.height * 0.0254 : vitals.height / 100;
      if (heightM > 0) {
        return (weightKg / (heightM * heightM)).toFixed(1);
      }
    }
    return null;
  };

  const bmi = calculateBMI();

  return (
    <div className="space-y-4">
      {/* New Vitals Entry */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Record Vitals</CardTitle>
              <Button onClick={onSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* BP */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Systolic</Label>
                <Input
                  type="number"
                  value={vitals.bloodPressureSystolic || ""}
                  onChange={(e) => updateVital("bloodPressureSystolic", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="120"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Diastolic</Label>
                <Input
                  type="number"
                  value={vitals.bloodPressureDiastolic || ""}
                  onChange={(e) => updateVital("bloodPressureDiastolic", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="80"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Pulse & SpO2 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Pulse (bpm)</Label>
                <Input
                  type="number"
                  value={vitals.pulseRate || ""}
                  onChange={(e) => updateVital("pulseRate", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="72"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">SpO₂ (%)</Label>
                <Input
                  type="number"
                  value={vitals.spO2 || ""}
                  onChange={(e) => updateVital("spO2", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="98"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Temperature */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Temperature</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitals.temperature || ""}
                  onChange={(e) => updateVital("temperature", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="98.6"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Select
                  value={vitals.temperatureUnit || "F"}
                  onValueChange={(v) => updateVital("temperatureUnit", v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">°F</SelectItem>
                    <SelectItem value="C">°C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weight & Height */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitals.weight || ""}
                  onChange={(e) => updateVital("weight", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="70"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Height (cm)</Label>
                <Input
                  type="number"
                  value={vitals.height || ""}
                  onChange={(e) => updateVital("height", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="170"
                  className="text-sm"
                />
              </div>
            </div>

            {/* BMI */}
            {bmi && (
              <div className="bg-blue-50 p-2 rounded text-sm">
                <span className="font-medium">BMI: </span>
                {bmi}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing Vitals */}
      {existingVitals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Recorded Vitals</h3>
          <div className="space-y-2">
            {existingVitals.map((v) => (
              <div key={v.id} className="text-sm bg-gray-50 p-2 rounded">
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(v.recordedAt).toLocaleString()}
                </p>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {v.bloodPressureSystolic && (
                    <span>BP: {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</span>
                  )}
                  {v.pulseRate && <span>Pulse: {v.pulseRate}</span>}
                  {v.spO2 && <span>SpO₂: {v.spO2}%</span>}
                  {v.temperature && <span>Temp: {v.temperature}°{v.temperatureUnit || "F"}</span>}
                  {v.weight && <span>Wt: {v.weight}kg</span>}
                  {v.bmi && <span>BMI: {v.bmi}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotesSection({
  notes,
  setNotes,
  onSave,
  saving,
  canEdit,
}: {
  notes: NotesData;
  setNotes: (n: NotesData) => void;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  const updateNote = (field: keyof NotesData, value: string) => {
    setNotes({ ...notes, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Clinical Notes</h3>
        {canEdit && (
          <Button onClick={onSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div>
        <Label className="text-xs">
          Chief Complaint <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={notes.chiefComplaint}
          onChange={(e) => updateNote("chiefComplaint", e.target.value)}
          placeholder="Patient presents with..."
          rows={2}
          disabled={!canEdit}
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">History of Present Illness</Label>
        <Textarea
          value={notes.historyOfPresentIllness || ""}
          onChange={(e) => updateNote("historyOfPresentIllness", e.target.value)}
          placeholder="Detailed history..."
          rows={3}
          disabled={!canEdit}
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Examination Findings</Label>
        <Textarea
          value={notes.physicalExamination || ""}
          onChange={(e) => updateNote("physicalExamination", e.target.value)}
          placeholder="Physical examination findings..."
          rows={3}
          disabled={!canEdit}
          className="mt-1 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Doctor&apos;s Remarks</Label>
        <Textarea
          value={notes.notes || ""}
          onChange={(e) => updateNote("notes", e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          disabled={!canEdit}
          className="mt-1 text-sm"
        />
      </div>
    </div>
  );
}

function LabsSection({
  labOrders,
  existingLabOrders,
  onAddLabOrder,
  onUpdateLabOrder,
  onRemoveLabOrder,
  onSave,
  saving,
  canEdit,
}: {
  labOrders: LabOrderItem[];
  existingLabOrders: ConsultationContext["labOrders"];
  onAddLabOrder: () => void;
  onUpdateLabOrder: (index: number, field: keyof LabOrderItem, value: string) => void;
  onRemoveLabOrder: (index: number) => void;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Lab Orders</h3>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAddLabOrder}>
              <Plus className="h-4 w-4 mr-1" />
              Add Test
            </Button>
            {labOrders.length > 0 && (
              <Button onClick={onSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* New Lab Orders */}
      {labOrders.length > 0 && (
        <div className="space-y-2">
          {labOrders.map((item, index) => (
            <div key={index} className="border rounded p-2 bg-gray-50">
              <div className="flex gap-2">
                <Input
                  value={item.testName}
                  onChange={(e) => onUpdateLabOrder(index, "testName", e.target.value)}
                  placeholder="Test name"
                  className="flex-1 text-sm"
                  disabled={!canEdit}
                />
                <Select
                  value={item.priority}
                  onValueChange={(v) => onUpdateLabOrder(index, "priority", v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-28 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onRemoveLabOrder(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Existing Lab Orders */}
      {existingLabOrders.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Ordered Tests</h4>
          <div className="space-y-2">
            {existingLabOrders.map((order) => (
              <div key={order.id} className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{order.orderNumber}</span>
                  <Badge variant={order.status === "COMPLETED" ? "default" : "secondary"}>
                    {order.status}
                  </Badge>
                </div>
                <div className="mt-1 space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="text-sm flex items-center gap-2">
                      <span>{item.testName}</span>
                      {item.priority !== "NORMAL" && (
                        <Badge variant={item.priority === "EMERGENCY" ? "destructive" : "secondary"} className="text-xs">
                          {item.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {labOrders.length === 0 && existingLabOrders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No lab orders</p>
        </div>
      )}
    </div>
  );
}
