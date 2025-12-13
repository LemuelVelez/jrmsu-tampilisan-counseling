/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Search,
    UserCircle2,
    X,
    CheckCircle2,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeRequestDto } from "@/api/intake/route";

type TimeOption = { value: string; label: string };

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
];

type FinalFilter = "all" | "final_set" | "final_unset";

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorApiFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
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

        const error = new Error(message) as Error & {
            status?: number;
            data?: unknown;
        };
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

type CounselorUpdatePayload = {
    status?: string;
    scheduled_date?: string;
    scheduled_time?: string;
};

async function updateAppointmentSchedule(
    requestId: number | string,
    scheduledDate: string,
    scheduledTime: string,
): Promise<any> {
    const payload: CounselorUpdatePayload = {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        status: "scheduled",
    };

    try {
        return await counselorApiFetch<any>(
            `/counselor/appointments/${requestId}`,
            {
                method: "PATCH",
                body: JSON.stringify(payload),
            },
        );
    } catch (err) {
        const e = err as any;
        if (e?.status === 404) {
            return counselorApiFetch<any>(
                `/counselor/intake/requests/${requestId}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                },
            );
        }
        throw err;
    }
}

async function updateAppointmentStatus(
    requestId: number | string,
    status: string,
): Promise<any> {
    const payload: CounselorUpdatePayload = { status };

    try {
        return await counselorApiFetch<any>(
            `/counselor/appointments/${requestId}`,
            {
                method: "PATCH",
                body: JSON.stringify(payload),
            },
        );
    } catch (err) {
        const e = err as any;
        if (e?.status === 404) {
            return counselorApiFetch<any>(
                `/counselor/intake/requests/${requestId}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                },
            );
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

// Final schedule should come only from scheduled_* (not preferred_*)
function getFinalDate(req: any): string | null {
    return (req?.scheduled_date as string | null) ?? null;
}
function getFinalTime(req: any): string | null {
    return (req?.scheduled_time as string | null) ?? null;
}

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

const CounselorAppointments: React.FC = () => {
    const [requests, setRequests] = React.useState<IntakeRequestDto[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [editingId, setEditingId] = React.useState<number | string | null>(null);
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
    const [editTime, setEditTime] = React.useState<string>("");
    const [isSaving, setIsSaving] = React.useState(false);

    const [statusDraftById, setStatusDraftById] = React.useState<
        Record<string, string>
    >({});
    const [statusSavingId, setStatusSavingId] = React.useState<number | string | null>(
        null,
    );

    // ✅ Search & filters
    const [searchQuery, setSearchQuery] = React.useState("");
    const [filterStatus, setFilterStatus] = React.useState<string>("all");
    const [filterUrgency, setFilterUrgency] = React.useState<string>("all");
    const [filterConcern, setFilterConcern] = React.useState<string>("all");
    const [filterFinal, setFilterFinal] = React.useState<FinalFilter>("all");

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

            setStatusDraftById((prev) => {
                const next = { ...prev };
                for (const r of sorted) {
                    const key = String(r.id);
                    if (next[key] === undefined) {
                        next[key] = String(r.status ?? "pending").toLowerCase() || "pending";
                    }
                }
                return next;
            });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to load appointments.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    const clearFilters = () => {
        setSearchQuery("");
        setFilterStatus("all");
        setFilterUrgency("all");
        setFilterConcern("all");
        setFilterFinal("all");
    };

    const filteredRequests = React.useMemo(() => {
        const q = normalizeText(searchQuery);

        return requests.filter((req) => {
            const status = normalizeText(req.status);
            const urgency = normalizeText(req.urgency);
            const concern = normalizeText(req.concern_type);

            if (filterStatus !== "all" && status !== normalizeText(filterStatus)) return false;
            if (filterUrgency !== "all" && urgency !== normalizeText(filterUrgency)) return false;
            if (filterConcern !== "all" && concern !== normalizeText(filterConcern)) return false;

            const finalDate = getFinalDate(req);
            const finalTime = getFinalTime(req);
            const hasFinal = Boolean(finalDate && finalTime);

            if (filterFinal === "final_set" && !hasFinal) return false;
            if (filterFinal === "final_unset" && hasFinal) return false;

            if (!q) return true;

            const studentName = getStudentDisplayName(req);
            const email = (req as any)?.user?.email ?? "";
            const concernLabel =
                (req.concern_type ? CONCERN_LABELS[normalizeText(req.concern_type)] : "") ?? "";
            const urgencyLabel =
                (req.urgency ? URGENCY_LABELS[normalizeText(req.urgency)] : "") ?? "";

            const haystack = normalizeText(
                [
                    req.id,
                    studentName,
                    email,
                    req.concern_type,
                    concernLabel,
                    req.urgency,
                    urgencyLabel,
                    req.status,
                    req.details,
                    req.preferred_date,
                    req.preferred_time,
                    finalDate ?? "",
                    finalTime ?? "",
                ].join(" "),
            );

            return haystack.includes(q);
        });
    }, [requests, searchQuery, filterStatus, filterUrgency, filterConcern, filterFinal]);

    const startEdit = (req: IntakeRequestDto) => {
        setEditingId(req.id);

        const existingDateStr = getFinalDate(req);
        const existingTimeStr = getFinalTime(req);

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
            toast.success("Final schedule saved (preferred schedule unchanged).");
            cancelEdit();
            void reload();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to update schedule.";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

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

    const handleUpdateStatus = async (req: IntakeRequestDto) => {
        const draft =
            statusDraftById[String(req.id)] ??
            String(req.status ?? "pending").toLowerCase();
        const current = String(req.status ?? "pending").toLowerCase();

        if (!draft || draft === current) {
            toast.message("No status change to update.");
            return;
        }

        setStatusSavingId(req.id);
        try {
            await updateAppointmentStatus(req.id, draft);
            toast.success(`Status updated to ${draft}.`);
            void reload();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to update status.";
            toast.error(message);
        } finally {
            setStatusSavingId(null);
        }
    };

    const totalCount = requests.length;
    const shownCount = filteredRequests.length;

    return (
        <DashboardLayout
            title="Appointments"
            description="Preferred schedule stays as the student’s request. Final schedule is set by the counselor. Update status so students know their request is being handled."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-5xl space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">
                                Guidance &amp; Counseling – Appointments
                            </p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                Preferred = student request. Final = counselor-confirmed schedule.
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
                                Search and filter requests, then set final schedule and update status
                                (Pending/Scheduled/Completed/Cancelled).
                            </p>

                            {/* ✅ Search + filters (shadcn) */}
                            <div className="mt-3 grid gap-2 sm:grid-cols-12">
                                <div className="sm:col-span-5">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search student, email, concern, details, ID…"
                                            className="h-9 pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All status</SelectItem>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="sm:col-span-2">
                                    <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Urgency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All urgency</SelectItem>
                                            {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="sm:col-span-2">
                                    <Select value={filterConcern} onValueChange={setFilterConcern}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Concern" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All concerns</SelectItem>
                                            {Object.entries(CONCERN_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="sm:col-span-1">
                                    <Select
                                        value={filterFinal}
                                        onValueChange={(v) => setFilterFinal(v as FinalFilter)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Final" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="final_set">Final set</SelectItem>
                                            <SelectItem value="final_unset">Not scheduled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1 text-[0.7rem] text-muted-foreground">
                                    <span>
                                        Showing{" "}
                                        <span className="font-medium text-amber-900">{shownCount}</span>{" "}
                                        of{" "}
                                        <span className="font-medium text-amber-900">{totalCount}</span>
                                    </span>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={clearFilters}
                                        className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                    >
                                        <X className="mr-1.5 h-3.5 w-3.5" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
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
                                </div>
                            )}

                            {!isLoading && requests.length > 0 && filteredRequests.length === 0 && (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No results match your current search/filters.
                                    <div className="mt-3">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={clearFilters}
                                            className="border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                        >
                                            <X className="mr-1.5 h-3.5 w-3.5" />
                                            Clear filters
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {!isLoading && filteredRequests.length > 0 && (
                                <div className="space-y-2">
                                    {filteredRequests.map((req) => {
                                        const studentName = getStudentDisplayName(req);
                                        const created = formatDateTime(req.created_at);
                                        const concern = formatConcernType(
                                            req.concern_type ?? undefined,
                                        );
                                        const urgencyLabel = formatUrgency(req.urgency ?? undefined);

                                        const preferredDate = formatDate(
                                            req.preferred_date ?? undefined,
                                        );
                                        const preferredTime = req.preferred_time
                                            ? String(req.preferred_time)
                                            : "—";

                                        const finalDateStr = getFinalDate(req);
                                        const finalTimeStr = getFinalTime(req);
                                        const finalDate = formatDate(finalDateStr ?? undefined);
                                        const finalTime = finalTimeStr
                                            ? String(finalTimeStr)
                                            : "—";

                                        const isEditing = editingId === req.id;

                                        const reqStatus = String(req.status ?? "pending").toLowerCase();
                                        const draftStatus =
                                            statusDraftById[String(req.id)] ?? reqStatus;
                                        const statusIsSaving = statusSavingId === req.id;

                                        return (
                                            <div
                                                key={req.id}
                                                className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2.5 text-xs"
                                            >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                                                                    Status:{" "}
                                                                    <span className="ml-1 capitalize">
                                                                        {String(req.status)}
                                                                    </span>
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

                                                    <div className="flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:items-end">
                                                        <div className="flex items-center gap-1.5 text-amber-900">
                                                            <CalendarClock className="h-3.5 w-3.5" />
                                                            <span className="font-medium">Schedule</span>
                                                        </div>

                                                        <div className="text-[0.7rem]">
                                                            <span className="font-medium">Preferred:</span>{" "}
                                                            <span className="font-medium text-amber-900">
                                                                {preferredDate}
                                                            </span>
                                                            {preferredTime !== "—" ? (
                                                                <span> · {preferredTime}</span>
                                                            ) : null}
                                                        </div>

                                                        <div className="text-[0.7rem]">
                                                            <span className="font-medium">Final:</span>{" "}
                                                            <span className="font-medium text-amber-900">
                                                                {finalDate}
                                                            </span>
                                                            {finalTime !== "—" ? (
                                                                <span> · {finalTime}</span>
                                                            ) : null}
                                                        </div>

                                                        <div className="text-[0.65rem] text-muted-foreground">
                                                            Requested: {created}
                                                        </div>

                                                        <div className="mt-2 flex w-full flex-col gap-2 sm:items-end">
                                                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                                                                <div className="w-full sm:w-[170px]">
                                                                    <Select
                                                                        value={draftStatus}
                                                                        onValueChange={(value) =>
                                                                            setStatusDraftById((prev) => ({
                                                                                ...prev,
                                                                                [String(req.id)]: value,
                                                                            }))
                                                                        }
                                                                        disabled={statusIsSaving}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-full bg-white/80 text-[0.7rem]">
                                                                            <SelectValue placeholder="Set status" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {STATUS_OPTIONS.map((opt) => (
                                                                                <SelectItem
                                                                                    key={opt.value}
                                                                                    value={opt.value}
                                                                                >
                                                                                    {opt.label}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                                    onClick={() => void handleUpdateStatus(req)}
                                                                    disabled={
                                                                        statusIsSaving ||
                                                                        (draftStatus ?? "") === reqStatus
                                                                    }
                                                                >
                                                                    {statusIsSaving ? (
                                                                        <>
                                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                            Updating…
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                                            Update status
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </div>

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
                                                                        {reqStatus === "scheduled"
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
                                                </div>

                                                {isEditing && (
                                                    <div className="mt-3 rounded-md border border-amber-100 bg-white/70 p-3">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                            <div className="grid w-full gap-3 sm:grid-cols-2">
                                                                <div className="space-y-1.5">
                                                                    <p className="text-[0.7rem] font-medium text-amber-900">
                                                                        Final date
                                                                    </p>
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className={`w-full justify-start text-left text-[0.75rem] font-normal ${!editDate
                                                                                    ? "text-muted-foreground"
                                                                                    : ""
                                                                                    }`}
                                                                                disabled={isSaving}
                                                                            >
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {editDate ? (
                                                                                    format(editDate, "PPP")
                                                                                ) : (
                                                                                    <span>Select date</span>
                                                                                )}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent
                                                                            className="w-auto p-0"
                                                                            align="start"
                                                                        >
                                                                            <Calendar
                                                                                mode="single"
                                                                                selected={editDate}
                                                                                onSelect={(d) => setEditDate(d ?? undefined)}
                                                                                initialFocus
                                                                            />
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <p className="text-[0.7rem] font-medium text-amber-900">
                                                                        Final time
                                                                    </p>
                                                                    <Select
                                                                        value={editTime}
                                                                        onValueChange={setEditTime}
                                                                        disabled={isSaving}
                                                                    >
                                                                        <SelectTrigger className="h-9 w-full text-left text-[0.75rem]">
                                                                            <SelectValue placeholder="Select time" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {TIME_OPTIONS.map((slot) => (
                                                                                <SelectItem
                                                                                    key={slot.value}
                                                                                    value={slot.value}
                                                                                >
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
                                                                            Save final schedule
                                                                        </>
                                                                    )}
                                                                </Button>
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
