"use client";

import { useState, useEffect } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api-client";

interface Slot {
  date: Date;
  time: string;
  doctorId: string;
  isAvailable: boolean;
  appointmentId?: string;
}

interface DoctorCalendarData {
  doctorId: string;
  doctorName: string;
  slots: Slot[];
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
}

interface DoctorCalendarProps {
  doctorIds: string[];
  departmentId?: string;
  onSlotSelect?: (slot: {
    doctorId: string;
    doctorName: string;
    date: Date;
    time: string;
  }) => void;
  selectedSlot?: {
    doctorId: string;
    date: Date;
    time: string;
  } | null;
}

export function DoctorCalendar({
  doctorIds,
  departmentId,
  onSlotSelect,
  selectedSlot,
}: DoctorCalendarProps) {
  const { addToast } = useToast();
  const [calendars, setCalendars] = useState<DoctorCalendarData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date())
  );

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendars = async () => {
      if (doctorIds.length === 0) return;

      try {
        setLoading(true);
        const endDate = addDays(currentWeekStart, 6);

        const response = await fetchApi(
          "/api/appointments/calendar?" +
            new URLSearchParams({
              doctorIds: doctorIds.join(","),
              startDate: currentWeekStart.toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
              departmentId: departmentId || "",
            }).toString(),
          { method: "GET" }
        );

        if (response.success) {
          console.log("[DoctorCalendar] Calendars loaded:", response.data);
          setCalendars(response.data || []);
        } else {
          addToast("error", "Failed to load doctor availability");
        }
      } catch (error) {
        console.error("[DoctorCalendar] Error fetching calendars:", error);
        addToast("error", "Failed to load doctor schedule");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendars();
  }, [doctorIds, currentWeekStart, departmentId, addToast]);

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  // Get unique dates in the week
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDays(currentWeekStart, i)
  );

  // Get all unique times across all doctors
  const allTimes = new Set<string>();
  calendars.forEach((cal) => {
    cal.slots.forEach((slot) => {
      allTimes.add(slot.time);
    });
  });
  const sortedTimes = Array.from(allTimes).sort();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Loading doctor availability...</p>
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-600">No doctor calendars available</p>
      </Card>
    );
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousWeek}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="text-center text-sm font-semibold">
          {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNextWeek}
          className="gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-6">
        {weekDates.map((date) => (
          <div key={date.toISOString()} className="border rounded-lg overflow-x-auto bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
              <div className="font-semibold text-gray-900">
                {format(date, "EEEE, MMM d")}
              </div>
              {isToday(date) && (
                <Badge variant="secondary" className="text-xs">
                  Today
                </Badge>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3 text-left font-semibold text-gray-700 w-24">
                    Time
                  </th>
                  {calendars.map((cal) => (
                    <th key={cal.doctorId} className="p-3 text-center font-semibold border-l">
                      <div className="font-semibold text-gray-900">{cal.doctorName}</div>
                      <div className="text-xs text-gray-600">
                        {cal.availableSlots}/{cal.totalSlots} slots
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTimes.map((time) => (
                  <tr key={`${date.toISOString()}-${time}`} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm font-mono text-gray-700 bg-gray-50 w-24">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                    </td>
                    {calendars.map((cal) => {
                      const slot = cal.slots.find(
                        (s) =>
                          s.time === time &&
                          new Date(s.date).toDateString() === date.toDateString()
                      );

                      if (!slot) {
                        return (
                          <td key={`${cal.doctorId}-${time}`} className="p-2 text-center border-l" />
                        );
                      }

                      const isSelected =
                        selectedSlot?.doctorId === cal.doctorId &&
                        selectedSlot?.time === time &&
                        new Date(selectedSlot.date).toDateString() === date.toDateString();

                      return (
                        <td key={`${cal.doctorId}-${time}`} className="p-2 text-center border-l">
                          <button
                            onClick={() => {
                              if (slot.isAvailable) {
                                console.log("[DoctorCalendar] Slot selected:", slot);
                                onSlotSelect?.({
                                  doctorId: cal.doctorId,
                                  doctorName: cal.doctorName,
                                  date,
                                  time,
                                });
                              }
                            }}
                            disabled={!slot.isAvailable}
                            className={`
                              w-full py-2 px-1 rounded text-xs font-medium transition-colors
                              ${
                                !slot.isAvailable
                                  ? "bg-red-100 text-red-700 cursor-not-allowed opacity-60"
                                  : isSelected
                                  ? "bg-blue-600 text-white shadow-md"
                                  : "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                              }
                            `}
                            title={!slot.isAvailable ? "Booked" : "Available"}
                          >
                            {slot.isAvailable ? "✓" : "✕"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
