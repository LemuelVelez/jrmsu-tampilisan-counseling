/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
    AlertCircle,
    Calendar as CalendarIcon,
    CalendarClock,
    ClipboardList as ClipboardListIcon,
    Loader2,
    Pencil,
    Save,
    UserCircle2,
    X,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeRequestDto } from "@/api/intake/route";

type TimeOption = { value: string; label: string };

// 30-minute slots with AM/PM labels (same as student intake)
const TIME_OPTIONS: TimeOption[] = [
    { value: "08:00 AM", label: "8:00 AM" },
    { value: "08:30 AM", label: "8:30 AM" },
    { value: "09:00 AM", label: "9:00 AM" },
    { value: "09:30 AM", label: "9:30 AM" },
    { value: "10:00 AM", label: "10:00 AM" },
    { value: "10:30 AM", label: "10:30 AM" },
    { value: "11:00 AM", label: "11:00 AM" },
    { value: "11:30 AM", label: "11:30 AM" },
    { value: "01:00 PM", label: "1:00 PM" },
    { value: "01:30 PM", label: "1:30 PM" },
    { value: "02:00 PM", label: "2:00 PM" },
    { value: "02:30 PM", label: "2:30 PM" },
    { value: "03:00 PM", label: "3:00 PM" },
    { value: "03:30 PM", label: "3:30 PM" },
    { value: "04:00 PM", label: "4:00 PM" },
    { value: "04:30 PM", label: "4:30 PM" },
];

const CONCERN_LABELS: Record<string, string> = {
    academic: "Academic",
    personal: "Personal / emotional",
    family: "Family",
    mental_health: "Mental health",
    career: "Career / future",
    other: "Other",
};

const URGENCY_LABELS: Record<string, string> = {
    low: "Not urgent",
    medium: "Soon (within 1–2 weeks)",
    high: "Urgent (as soon as possible)",
};

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        credentials: "include",
    });

    const text = await response.text();
    let data: unknown = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const body = data as any;

        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object"
                ? (Object.values(body.errors)[0] as any)?.[0]
                : undefined;

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const error = new Error(message) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

async function fetchCounselingRequests(): Promise<IntakeRequestDto[]> {
    const raw = await counselorApiFetch<any>("/counselor/intake/requests");

    const list =
        Array.isArray(raw) && raw.length && typeof raw[0] === "object"
            ? raw
            : Array.isArray(raw?.requests)
                ? raw.requests
                : Array.isArray(raw?.intakes)
                    ? raw.intakes
                    : Array.isArray(raw?.data)
                        ? raw.data
                        : [];

    return list as IntakeRequestDto[];
}

type UpdateSchedulePayload = {
    // Send both “scheduled_*” and “preferred_*” so backend can accept either model.
    scheduled_date?: string;
    scheduled_time?: string;
    preferred_date?: string;
    preferred_time?: string;
    status?: string;
};

async function updateAppointmentSchedule(
    requestId: number | string,
    scheduledDate: string,
    scheduledTime: string,
): Promise<any> {
    const payload: UpdateSchedulePayload = {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        preferred_date: scheduledDate,
        preferred_time: scheduledTime,
        status: "scheduled",
    };

    // Try “appointments” first, then fall back to “intake/requests”.
    try {
        return await counselorApiFetch<any>(`/counselor/appointments/${requestId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    } catch (err) {
        const e = err as any;
        if (e?.status === 404) {
            return counselorApiFetch<any>(`/counselor/intake/requests/${requestId}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        }
        throw err;
    }
}

function getStudentDisplayName(record: any): string {
    const candidate =
        record?.student_name ??
        record?.student_full_name ??
        record?.full_name ??
        record?.name ??
        record?.user_name ??
        record?.user?.name;

    const id = record?.user_id ?? record?.student_id ?? record?.user?.id;

    if (candidate && typeof candidate === "string") return candidate;
    if (id !== undefined && id !== null) return `Student #${String(id)}`;
    return "Unknown student";
}

function formatDate(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy");
    } catch {
        return dateString;
    }
}

function formatDateTime(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy – h:mm a");
    } catch {
        return dateString;
    }
}

function formatConcernType(raw?: string | null): string {
    if (!raw) return "—";
    const value = raw.toLowerCase();
    if (CONCERN_LABELS[value]) return CONCERN_LABELS[value];
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatUrgency(raw?: string | null): string {
    if (!raw) return "—";
    const value = raw.toLowerCase();
    return URGENCY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

function urgencyClassName(raw?: string | null): string {
    const value = (raw ?? "").toLowerCase();
    if (value === "high") return "border-red-200 bg-red-50 text-red-800";
    if (value === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
    if (value === "low") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    return "border-slate-200 bg-slate-50 text-slate-800";
}

function statusClassName(raw?: string | null): string {
    const value = (raw ?? "").toLowerCase();
    if (value === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
    if (value === "scheduled") return "border-blue-200 bg-blue-50 text-blue-900";
    if (value === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (value === "cancelled" || value === "canceled") {
        return "border-slate-200 bg-slate-50 text-slate-800 line-through";
    }
    return "border-slate-200 bg-slate-50 text-slate-800";
}

// If your backend stores an explicit scheduled_* pair, we’ll use it; otherwise fall back to preferred_*.
function getScheduledDate(req: any): string | null {
    return (req?.scheduled_date as string | null) ?? (req?.appointment_date as string | null) ?? req?.preferred_date ?? null;
}
function getScheduledTime(req: any): string | null {
    return (req?.scheduled_time as string | null) ?? (req?.appointment_time as string | null) ?? req?.preferred_time ?? null;
}

const CounselorAppointments: React.FC = () => {
    const [requests, setRequests] = React.useState<IntakeRequestDto[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [editingId, setEditingId] = React.useState<number | string | null>(null);
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
    const [editTime, setEditTime] = React.useState<string>("");
    const [isSaving, setIsSaving] = React.useState(false);

    const reload = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const items = await fetchCounselingRequests();
            const sorted = [...items].sort((a, b) => {
                const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
                const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
                return bCreated - aCreated;
            });
            setRequests(sorted);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load appointments.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    const startEdit = (req: IntakeRequestDto) => {
        setEditingId(req.id);

        const existingDateStr = getScheduledDate(req);
        const existingTimeStr = getScheduledTime(req);

        if (existingDateStr) {
            try {
                setEditDate(parseISO(existingDateStr));
            } catch {
                setEditDate(undefined);
            }
        } else {
            setEditDate(undefined);
        }

        setEditTime(existingTimeStr ?? "");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditDate(undefined);
        setEditTime("");
    };

    const saveSchedule = async (req: IntakeRequestDto) => {
        if (!editDate) {
            toast.error("Please select an appointment date.");
            return;
        }
        if (!editTime) {
            toast.error("Please select an appointment time.");
            return;
        }

        const scheduledDate = format(editDate, "yyyy-MM-dd");
        const scheduledTime = editTime;

        setIsSaving(true);
        try {
            await updateAppointmentSchedule(req.id, scheduledDate, scheduledTime);
            toast.success("Appointment schedule updated.");
            cancelEdit();
            void reload();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update schedule.";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    // renamed from useStudentPreferred -> applyStudentPreferred
    const applyStudentPreferred = (req: IntakeRequestDto) => {
        const d = req.preferred_date;
        const t = req.preferred_time;

        if (d) {
            try {
                setEditDate(parseISO(d));
            } catch {
                // ignore
            }
        }
        if (t) setEditTime(String(t));
    };

    return (
        <DashboardLayout
            title="Appointments"
            description="Counseling requests are treated as appointments. Schedule or reschedule based on your availability."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-5xl space-y-4">
                    {/* Top controls */}
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">Guidance &amp; Counseling – Appointments</p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                Review incoming requests and set the final schedule. Use “Schedule / Reschedule”
                                to adjust the appointment date/time.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void reload()}
                                className="border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Refreshing…
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5" />
                                        Refresh
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                Counseling appointments
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Shows student requests, preferred schedule, and current status. Set the final
                                schedule when you’re available.
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {error && (
                                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-800">
                                    <AlertCircle className="mt-px h-3.5 w-3.5" />
                                    <div>
                                        <p className="font-medium">Unable to load appointments.</p>
                                        <p className="text-[0.7rem] opacity-90">{error}</p>
                                    </div>
                                </div>
                            )}

                            {isLoading && !requests.length ? (
                                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading appointments…
                                </div>
                            ) : null}

                            {!isLoading && requests.length === 0 && !error && (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No counseling requests/appointments yet.
                                    <br />
                                    New student requests will appear here automatically.
                                </div>
                            )}

                            {!isLoading && requests.length > 0 && (
                                <div className="space-y-2">
                                    {requests.map((req) => {
                                        const studentName = getStudentDisplayName(req);
                                        const created = formatDateTime(req.created_at);
                                        const concern = formatConcernType(req.concern_type ?? undefined);
                                        const urgencyLabel = formatUrgency(req.urgency ?? undefined);

                                        const preferredDate = formatDate(req.preferred_date ?? undefined);
                                        const preferredTime = req.preferred_time ? String(req.preferred_time) : "—";

                                        const finalDateStr = getScheduledDate(req);
                                        const finalTimeStr = getScheduledTime(req);
                                        const finalDate = formatDate(finalDateStr ?? undefined);
                                        const finalTime = finalTimeStr ? String(finalTimeStr) : "—";

                                        const isEditing = editingId === req.id;

                                        return (
                                            <div
                                                key={req.id}
                                                className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2.5 text-xs"
                                            >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    {/* Left */}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-amber-900">
                                                            <UserCircle2 className="h-3.5 w-3.5 text-amber-700" />
                                                            <span>{studentName}</span>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.7rem] font-medium text-amber-900">
                                                                Concern: {concern}
                                                            </span>

                                                            {req.urgency && (
                                                                <span
                                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${urgencyClassName(
                                                                        req.urgency,
                                                                    )}`}
                                                                >
                                                                    {urgencyLabel}
                                                                </span>
                                                            )}

                                                            {req.status && (
                                                                <span
                                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${statusClassName(
                                                                        req.status,
                                                                    )}`}
                                                                >
                                                                    Status: <span className="ml-1 capitalize">{String(req.status)}</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {req.details && (
                                                            <p className="max-w-2xl text-[0.7rem] text-muted-foreground">
                                                                {String(req.details).length > 220
                                                                    ? `${String(req.details).slice(0, 220)}…`
                                                                    : String(req.details)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Right */}
                                                    <div className="flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:items-end">
                                                        <div className="flex items-center gap-1.5 text-amber-900">
                                                            <CalendarClock className="h-3.5 w-3.5" />
                                                            <span className="font-medium">Schedule</span>
                                                        </div>

                                                        <div className="text-[0.7rem]">
                                                            <span className="font-medium">Preferred:</span>{" "}
                                                            <span className="font-medium text-amber-900">{preferredDate}</span>
                                                            {preferredTime !== "—" ? <span> · {preferredTime}</span> : null}
                                                        </div>

                                                        <div className="text-[0.7rem]">
                                                            <span className="font-medium">Final:</span>{" "}
                                                            <span className="font-medium text-amber-900">{finalDate}</span>
                                                            {finalTime !== "—" ? <span> · {finalTime}</span> : null}
                                                        </div>

                                                        <div className="text-[0.65rem] text-muted-foreground">Requested: {created}</div>

                                                        <div className="mt-1 flex flex-wrap gap-2 sm:justify-end">
                                                            {!isEditing ? (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                                    onClick={() => startEdit(req)}
                                                                >
                                                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                                    {String(req.status ?? "").toLowerCase() === "scheduled"
                                                                        ? "Reschedule"
                                                                        : "Schedule"}
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-slate-200 bg-white/80 text-[0.7rem] text-slate-800 hover:bg-slate-50"
                                                                    onClick={cancelEdit}
                                                                    disabled={isSaving}
                                                                >
                                                                    <X className="mr-1.5 h-3.5 w-3.5" />
                                                                    Cancel
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Inline editor */}
                                                {isEditing && (
                                                    <div className="mt-3 rounded-md border border-amber-100 bg-white/70 p-3">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                            <div className="grid w-full gap-3 sm:grid-cols-2">
                                                                {/* Date */}
                                                                <div className="space-y-1.5">
                                                                    <p className="text-[0.7rem] font-medium text-amber-900">Appointment date</p>
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className={`w-full justify-start text-left text-[0.75rem] font-normal ${!editDate ? "text-muted-foreground" : ""
                                                                                    }`}
                                                                                disabled={isSaving}
                                                                            >
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {editDate ? format(editDate, "PPP") : <span>Select date</span>}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0" align="start">
                                                                            <Calendar
                                                                                mode="single"
                                                                                selected={editDate}
                                                                                onSelect={(date) => setEditDate(date ?? undefined)}
                                                                                initialFocus
                                                                            />
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                </div>

                                                                {/* Time */}
                                                                <div className="space-y-1.5">
                                                                    <p className="text-[0.7rem] font-medium text-amber-900">Appointment time</p>
                                                                    <Select value={editTime} onValueChange={setEditTime} disabled={isSaving}>
                                                                        <SelectTrigger className="h-9 w-full text-left text-[0.75rem]">
                                                                            <SelectValue placeholder="Select time" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {TIME_OPTIONS.map((slot) => (
                                                                                <SelectItem key={slot.value} value={slot.value}>
                                                                                    {slot.label}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px] sm:items-end">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                                    onClick={() => applyStudentPreferred(req)}
                                                                    disabled={isSaving}
                                                                >
                                                                    Use student preferred
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    className="h-8 text-[0.7rem]"
                                                                    onClick={() => void saveSchedule(req)}
                                                                    disabled={isSaving}
                                                                >
                                                                    {isSaving ? (
                                                                        <>
                                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                            Saving…
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Save className="mr-1.5 h-3.5 w-3.5" />
                                                                            Save schedule
                                                                        </>
                                                                    )}
                                                                </Button>

                                                                <p className="text-[0.65rem] text-muted-foreground sm:text-right">
                                                                    Set the final schedule based on your availability. If the server
                                                                    rejects the slot (conflict/unavailable), you’ll see the error.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default CounselorAppointments;
