/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import {
    AlertCircle,
    Calendar as CalendarIcon,
    CheckCircle2,
    ClipboardList as ClipboardListIcon,
    Loader2,
    Pencil,
    Save,
    Search,
    Trash2,
    UserCircle2,
    X,
} from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader as ShadTableHeader,
    TableRow,
} from "@/components/ui/table"

import { AUTH_API_BASE_URL } from "@/api/auth/route"
import type { IntakeRequestDto } from "@/api/intake/route"

type TimeOption = { value: string; label: string }

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
]

const CONCERN_LABELS: Record<string, string> = {
    academic: "Academic",
    personal: "Personal / emotional",
    family: "Family",
    mental_health: "Mental health",
    career: "Career / future",
    other: "Other",
}

const URGENCY_LABELS: Record<string, string> = {
    low: "Not urgent",
    medium: "Soon (within 1–2 weeks)",
    high: "Urgent (as soon as possible)",
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
]

type FinalFilter = "all" | "final_set" | "final_unset"

type PaginationMeta = {
    current_page: number
    last_page: number
    per_page: number
    total: number
}

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.")
    }
    const trimmed = path.replace(/^\/+/, "")
    return `${AUTH_API_BASE_URL}/${trimmed}`
}

function buildQueryString(params?: Record<string, any>): string {
    if (!params) return ""
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return
        sp.set(k, String(v))
    })
    const qs = sp.toString()
    return qs ? `?${qs}` : ""
}

async function counselorApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveApiUrl(path)

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        credentials: "include",
    })

    const text = await response.text()
    let data: unknown = null

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = text
        }
    }

    if (!response.ok) {
        const body = data as any

        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object" ? (Object.values(body.errors)[0] as any)?.[0] : undefined

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            response.statusText ||
            "An unknown error occurred while communicating with the server."

        const error = new Error(message) as Error & { status?: number; data?: unknown }
        error.status = response.status
        error.data = body ?? text
        throw error
    }

    return data as T
}

/**
 * ✅ Supports BOTH:
 * - old response: array
 * - new response: { requests: [], meta: { ... } }
 */
async function fetchCounselingRequestsPage(args: {
    page: number
    perPage: number
}): Promise<{ items: IntakeRequestDto[]; meta: PaginationMeta }> {
    const qs = buildQueryString({
        page: args.page,
        per_page: args.perPage,
    })

    const raw = await counselorApiFetch<any>(`/counselor/intake/requests${qs}`)

    // ✅ If backend returns array (older behavior)
    if (Array.isArray(raw)) {
        const items = raw as IntakeRequestDto[]
        const total = items.length
        const per_page = args.perPage
        const last_page = Math.max(1, Math.ceil(total / per_page))
        const current_page = Math.min(Math.max(1, args.page), last_page)

        // slice to enforce 10/page even if backend returns all
        const start = (current_page - 1) * per_page
        const paged = items.slice(start, start + per_page)

        return {
            items: paged,
            meta: { current_page, last_page, per_page, total },
        }
    }

    const list =
        Array.isArray(raw?.requests)
            ? raw.requests
            : Array.isArray(raw?.data)
                ? raw.data
                : Array.isArray(raw?.intakes)
                    ? raw.intakes
                    : []

    const metaSrc = raw?.meta ?? raw ?? {}
    const meta: PaginationMeta = {
        current_page: Number(metaSrc?.current_page ?? args.page ?? 1) || 1,
        last_page: Number(metaSrc?.last_page ?? 1) || 1,
        per_page: Number(metaSrc?.per_page ?? args.perPage ?? 10) || args.perPage,
        total: Number(metaSrc?.total ?? list.length ?? 0) || 0,
    }

    return { items: list as IntakeRequestDto[], meta }
}

type CounselorUpdatePayload = {
    status?: string
    scheduled_date?: string
    scheduled_time?: string
}

async function updateAppointmentSchedule(
    requestId: number | string,
    scheduledDate: string,
    scheduledTime: string,
): Promise<any> {
    const payload: CounselorUpdatePayload = {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        status: "scheduled",
    }

    try {
        return await counselorApiFetch<any>(`/counselor/appointments/${requestId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        })
    } catch (err) {
        const e = err as any
        if (e?.status === 404) {
            return counselorApiFetch<any>(`/counselor/intake/requests/${requestId}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            })
        }
        throw err
    }
}

async function updateAppointmentStatus(requestId: number | string, status: string): Promise<any> {
    const payload: CounselorUpdatePayload = { status }

    try {
        return await counselorApiFetch<any>(`/counselor/appointments/${requestId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        })
    } catch (err) {
        const e = err as any
        if (e?.status === 404) {
            return counselorApiFetch<any>(`/counselor/intake/requests/${requestId}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            })
        }
        throw err
    }
}

async function deleteAppointment(requestId: number | string): Promise<any> {
    try {
        return await counselorApiFetch<any>(`/counselor/appointments/${requestId}`, {
            method: "DELETE",
        })
    } catch (err) {
        const e = err as any
        if (e?.status === 404) {
            return counselorApiFetch<any>(`/counselor/intake/requests/${requestId}`, {
                method: "DELETE",
            })
        }
        throw err
    }
}

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase()
}

function getStudentDisplayName(record: any): string {
    const candidate =
        record?.student_name ??
        record?.student_full_name ??
        record?.full_name ??
        record?.name ??
        record?.user_name ??
        record?.user?.name

    const id = record?.user_id ?? record?.student_id ?? record?.user?.id

    if (candidate && typeof candidate === "string") return candidate
    if (id !== undefined && id !== null) return `Student #${String(id)}`
    return "Unknown student"
}

function getStudentId(record: any): number | string | null {
    const id = record?.user_id ?? record?.student_id ?? record?.user?.id ?? null
    if (id === null || id === undefined) return null
    return id
}

function formatDate(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—"
    try {
        return format(parseISO(dateString), "MMM d, yyyy")
    } catch {
        return dateString
    }
}

function formatDateTime(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—"
    try {
        return format(parseISO(dateString), "MMM d, yyyy – h:mm a")
    } catch {
        return dateString
    }
}

function formatConcernType(raw?: string | null): string {
    if (!raw) return "—"
    const value = raw.toLowerCase()
    if (CONCERN_LABELS[value]) return CONCERN_LABELS[value]
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

function formatUrgency(raw?: string | null): string {
    if (!raw) return "—"
    const value = raw.toLowerCase()
    return URGENCY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
}

function urgencyClassName(raw?: string | null): string {
    const value = (raw ?? "").toLowerCase()
    if (value === "high") return "border-red-200 bg-red-50 text-red-800"
    if (value === "medium") return "border-amber-200 bg-amber-50 text-amber-900"
    if (value === "low") return "border-emerald-200 bg-emerald-50 text-emerald-900"
    return "border-slate-200 bg-slate-50 text-slate-800"
}

function statusClassName(raw?: string | null): string {
    const value = (raw ?? "").toLowerCase()
    if (value === "pending") return "border-amber-200 bg-amber-50 text-amber-900"
    if (value === "scheduled") return "border-blue-200 bg-blue-50 text-blue-900"
    if (value === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-900"
    if (value === "cancelled" || value === "canceled") {
        return "border-slate-200 bg-slate-50 text-slate-800"
    }
    return "border-slate-200 bg-slate-50 text-slate-800"
}

// Final schedule should come only from scheduled_* (not preferred_*)
function getFinalDate(req: any): string | null {
    return (req?.scheduled_date as string | null) ?? null
}
function getFinalTime(req: any): string | null {
    return (req?.scheduled_time as string | null) ?? null
}

function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = React.useState(value)

    React.useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(id)
    }, [value, delay])

    return debounced
}

async function fetchCounselorStudentProfile(studentId: number | string): Promise<any> {
    return counselorApiFetch<any>(`/counselor/students/${studentId}`)
}

async function fetchCounselorStudentHistory(studentId: number | string): Promise<any> {
    return counselorApiFetch<any>(`/counselor/students/${studentId}/history`)
}

const PER_PAGE = 10

const CounselorAppointments: React.FC = () => {
    const [requests, setRequests] = React.useState<IntakeRequestDto[]>([])
    const [meta, setMeta] = React.useState<PaginationMeta>({
        current_page: 1,
        last_page: 1,
        per_page: PER_PAGE,
        total: 0,
    })

    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // ✅ Search & filters
    const [searchQuery, setSearchQuery] = React.useState("")
    const debouncedSearch = useDebouncedValue(searchQuery, 350)
    const [filterStatus, setFilterStatus] = React.useState<string>("all")
    const [filterUrgency, setFilterUrgency] = React.useState<string>("all")
    const [filterConcern, setFilterConcern] = React.useState<string>("all")
    const [filterFinal, setFilterFinal] = React.useState<FinalFilter>("all")

    // ✅ pagination
    const [page, setPage] = React.useState<number>(1)

    // ✅ status update
    const [statusDraftById, setStatusDraftById] = React.useState<Record<string, string>>({})
    const [statusSavingId, setStatusSavingId] = React.useState<number | string | null>(null)

    // ✅ schedule dialog
    const [scheduleOpen, setScheduleOpen] = React.useState(false)
    const [scheduleTarget, setScheduleTarget] = React.useState<IntakeRequestDto | null>(null)
    const [editDate, setEditDate] = React.useState<Date | undefined>(undefined)
    const [editTime, setEditTime] = React.useState<string>("")
    const [isSaving, setIsSaving] = React.useState(false)

    // ✅ delete confirmation
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [deleteTarget, setDeleteTarget] = React.useState<IntakeRequestDto | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)

    // ✅ student profile dialog
    const [profileOpen, setProfileOpen] = React.useState(false)
    const [profileStudentId, setProfileStudentId] = React.useState<number | string | null>(null)
    const [profileLoading, setProfileLoading] = React.useState(false)
    const [profileError, setProfileError] = React.useState<string | null>(null)
    const [profileData, setProfileData] = React.useState<any>(null)
    const [historyData, setHistoryData] = React.useState<any>(null)

    const clearFilters = () => {
        setSearchQuery("")
        setFilterStatus("all")
        setFilterUrgency("all")
        setFilterConcern("all")
        setFilterFinal("all")
        setPage(1)
    }

    const reload = React.useCallback(
        async (goToPage?: number) => {
            const nextPage = goToPage ?? page

            setIsLoading(true)
            setError(null)

            try {
                const { items, meta } = await fetchCounselingRequestsPage({
                    page: nextPage,
                    perPage: PER_PAGE,
                })

                // sort newest first (safe)
                const sorted = [...items].sort((a, b) => {
                    const aCreated = a.created_at ? Date.parse(String(a.created_at)) : 0
                    const bCreated = b.created_at ? Date.parse(String(b.created_at)) : 0
                    return bCreated - aCreated
                })

                setRequests(sorted)
                setMeta(meta)

                setStatusDraftById((prev) => {
                    const next = { ...prev }
                    for (const r of sorted) {
                        const key = String(r.id)
                        if (next[key] === undefined) {
                            next[key] = String(r.status ?? "pending").toLowerCase() || "pending"
                        }
                    }
                    return next
                })
            } catch (err: any) {
                const message = err instanceof Error ? err.message : "Failed to load appointments."
                setError(message)
                toast.error(message)
            } finally {
                setIsLoading(false)
            }
        },
        [page],
    )

    // when search/status changes, reset to page 1
    React.useEffect(() => {
        setPage(1)
    }, [debouncedSearch, filterStatus])

    // load when page changes
    React.useEffect(() => {
        void reload(page)
    }, [page, reload])

    const filteredRequests = React.useMemo(() => {
        const q = normalizeText(debouncedSearch)

        return requests.filter((req) => {
            const status = normalizeText(req.status)
            const urgency = normalizeText(req.urgency)
            const concern = normalizeText(req.concern_type)

            if (filterStatus !== "all" && status !== normalizeText(filterStatus)) return false
            if (filterUrgency !== "all" && urgency !== normalizeText(filterUrgency)) return false
            if (filterConcern !== "all" && concern !== normalizeText(filterConcern)) return false

            const finalDate = getFinalDate(req)
            const finalTime = getFinalTime(req)
            const hasFinal = Boolean(finalDate && finalTime)

            if (filterFinal === "final_set" && !hasFinal) return false
            if (filterFinal === "final_unset" && hasFinal) return false

            if (!q) return true

            const studentName = getStudentDisplayName(req)
            const email = (req as any)?.user?.email ?? (req as any)?.student_email ?? ""
            const concernLabel = (req.concern_type ? CONCERN_LABELS[normalizeText(req.concern_type)] : "") ?? ""
            const urgencyLabel = (req.urgency ? URGENCY_LABELS[normalizeText(req.urgency)] : "") ?? ""

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
                    getFinalDate(req) ?? "",
                    getFinalTime(req) ?? "",
                ].join(" "),
            )

            return haystack.includes(q)
        })
    }, [requests, debouncedSearch, filterStatus, filterUrgency, filterConcern, filterFinal])

    const openScheduleDialog = (req: IntakeRequestDto) => {
        setScheduleTarget(req)

        const existingDateStr = getFinalDate(req)
        const existingTimeStr = getFinalTime(req)

        if (existingDateStr) {
            try {
                setEditDate(parseISO(existingDateStr))
            } catch {
                setEditDate(undefined)
            }
        } else {
            setEditDate(undefined)
        }

        setEditTime(existingTimeStr ?? "")
        setScheduleOpen(true)
    }

    const closeScheduleDialog = () => {
        setScheduleOpen(false)
        setScheduleTarget(null)
        setEditDate(undefined)
        setEditTime("")
    }

    const applyStudentPreferred = (req: IntakeRequestDto) => {
        const d = req.preferred_date
        const t = req.preferred_time

        if (d) {
            try {
                setEditDate(parseISO(d))
            } catch {
                // ignore
            }
        }
        if (t) setEditTime(String(t))
    }

    const saveSchedule = async () => {
        if (!scheduleTarget) return

        if (!editDate) {
            toast.error("Please select an appointment date.")
            return
        }
        if (!editTime) {
            toast.error("Please select an appointment time.")
            return
        }

        const scheduledDate = format(editDate, "yyyy-MM-dd")
        const scheduledTime = editTime

        setIsSaving(true)
        try {
            await updateAppointmentSchedule(scheduleTarget.id, scheduledDate, scheduledTime)
            toast.success("Final schedule saved (preferred schedule unchanged).")
            closeScheduleDialog()
            void reload(page)
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update schedule."
            toast.error(message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpdateStatus = async (req: IntakeRequestDto) => {
        const draft = statusDraftById[String(req.id)] ?? String(req.status ?? "pending").toLowerCase()
        const current = String(req.status ?? "pending").toLowerCase()

        if (!draft || draft === current) {
            toast.message("No status change to update.")
            return
        }

        setStatusSavingId(req.id)
        try {
            await updateAppointmentStatus(req.id, draft)
            toast.success(`Status updated to ${draft}.`)
            void reload(page)
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update status."
            toast.error(message)
        } finally {
            setStatusSavingId(null)
        }
    }

    const askDelete = (req: IntakeRequestDto) => {
        setDeleteTarget(req)
        setDeleteOpen(true)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return

        setIsDeleting(true)
        try {
            await deleteAppointment(deleteTarget.id)
            toast.success("Appointment/request deleted.")
            setDeleteOpen(false)
            setDeleteTarget(null)

            // if we deleted the last row on this page, try going back a page
            const maybeGoBack = filteredRequests.length <= 1 && page > 1
            if (maybeGoBack) setPage((p) => Math.max(1, p - 1))
            else void reload(page)
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete appointment."
            toast.error(message)
        } finally {
            setIsDeleting(false)
        }
    }

    const openStudentProfile = async (req: IntakeRequestDto) => {
        const id = getStudentId(req)
        if (id === null) {
            toast.error("Unable to open student profile (missing student id).")
            return
        }

        setProfileStudentId(id)
        setProfileOpen(true)

        setProfileLoading(true)
        setProfileError(null)
        setProfileData(null)
        setHistoryData(null)

        try {
            const [profileRes, historyRes] = await Promise.all([
                fetchCounselorStudentProfile(id),
                fetchCounselorStudentHistory(id),
            ])

            setProfileData(profileRes?.student ?? profileRes ?? null)
            setHistoryData(historyRes?.history ?? historyRes ?? null)
        } catch (err: any) {
            const message = err instanceof Error ? err.message : "Failed to load student profile."
            setProfileError(message)
        } finally {
            setProfileLoading(false)
        }
    }

    const totalCount = meta.total ?? requests.length
    const shownCount = filteredRequests.length

    const canPrev = page > 1
    const canNext = page < (meta.last_page ?? 1)

    return (
        <DashboardLayout
            title="Appointments"
            description="Preferred schedule stays as the student’s request. Final schedule is set by the counselor. Update status so students know their request is being handled."
        >
            <div className="flex w-full justify-center">
                <div className="w-full px-4 space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">Guidance &amp; Counseling – Appointments</p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                Preferred = student request. Final = counselor-confirmed schedule.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void reload(page)}
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
                                Table view with pagination (10 per page). Click a student name to view profile + counseling history.
                            </p>

                            <div className="mt-3 grid gap-2 sm:grid-cols-12">
                                <div className="sm:col-span-5">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search student, concern, details, ID…"
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
                                    <Select value={filterFinal} onValueChange={(v) => setFilterFinal(v as FinalFilter)}>
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
                                        Showing <span className="font-medium text-amber-900">{shownCount}</span> of{" "}
                                        <span className="font-medium text-amber-900">{totalCount}</span> (page{" "}
                                        <span className="font-medium text-amber-900">{page}</span> /{" "}
                                        <span className="font-medium text-amber-900">{meta.last_page}</span>)
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

                            {!isLoading && meta.total === 0 && !error && (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No counseling requests/appointments yet.
                                </div>
                            )}

                            {!isLoading && meta.total > 0 && filteredRequests.length === 0 && (
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
                                <div className="rounded-md border border-amber-100 bg-white">
                                    <Table>
                                        <ShadTableHeader>
                                            <TableRow>
                                                <TableHead className="w-60">Student</TableHead>
                                                <TableHead>Concern</TableHead>
                                                <TableHead className="w-[140px]">Urgency</TableHead>
                                                <TableHead className="w-[220px]">Status</TableHead>
                                                <TableHead className="w-[210px]">Preferred</TableHead>
                                                <TableHead className="w-[210px]">Final</TableHead>
                                                <TableHead className="w-[180px]">Requested</TableHead>
                                                <TableHead className="w-[170px] text-right">Actions</TableHead>
                                            </TableRow>
                                        </ShadTableHeader>

                                        <TableBody>
                                            {filteredRequests.map((req) => {
                                                const studentName = getStudentDisplayName(req)

                                                const concern = formatConcernType(req.concern_type ?? undefined)
                                                const urgencyLabel = formatUrgency(req.urgency ?? undefined)

                                                const preferredDate = formatDate(req.preferred_date ?? undefined)
                                                const preferredTime = req.preferred_time ? String(req.preferred_time) : "—"

                                                const finalDateStr = getFinalDate(req)
                                                const finalTimeStr = getFinalTime(req)
                                                const finalDate = formatDate(finalDateStr ?? undefined)
                                                const finalTime = finalTimeStr ? String(finalTimeStr) : "—"

                                                const created = formatDateTime(req.created_at)

                                                const reqStatus = String(req.status ?? "pending").toLowerCase()
                                                const draftStatus = statusDraftById[String(req.id)] ?? reqStatus
                                                const statusIsSaving = statusSavingId === req.id

                                                return (
                                                    <TableRow key={req.id}>
                                                        <TableCell className="align-top">
                                                            <div className="flex items-start gap-2">
                                                                <UserCircle2 className="mt-0.5 h-4 w-4 text-amber-700" />
                                                                <div className="min-w-0">
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        className="h-auto p-0 text-left text-[0.8rem] font-semibold text-amber-900"
                                                                        onClick={() => void openStudentProfile(req)}
                                                                    >
                                                                        {studentName}
                                                                    </Button>
                                                                    {(req as any)?.user?.email ? (
                                                                        <div className="truncate text-[0.7rem] text-muted-foreground">
                                                                            {(req as any)?.user?.email}
                                                                        </div>
                                                                    ) : null}
                                                                    {req.details ? (
                                                                        <div className="mt-1 line-clamp-2 max-w-88 text-[0.7rem] text-muted-foreground">
                                                                            {String(req.details)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-[0.75rem] font-medium text-foreground">{concern}</div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <Badge
                                                                className={`rounded-full border px-2 py-0.5 text-[0.65rem] ${urgencyClassName(
                                                                    req.urgency,
                                                                )}`}
                                                            >
                                                                {urgencyLabel}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="flex flex-col gap-2">
                                                                <Badge
                                                                    className={`w-fit rounded-full border px-2 py-0.5 text-[0.65rem] ${statusClassName(
                                                                        req.status,
                                                                    )}`}
                                                                >
                                                                    Status:{" "}
                                                                    <span className="ml-1 capitalize">
                                                                        {String(req.status ?? "pending")}
                                                                    </span>
                                                                </Badge>

                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                    <div className="w-full sm:w-44">
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
                                                                            <SelectTrigger className="h-8 w-full bg-white text-[0.7rem]">
                                                                                <SelectValue placeholder="Set status" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {STATUS_OPTIONS.map((opt) => (
                                                                                    <SelectItem key={opt.value} value={opt.value}>
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
                                                                        className="h-8 border-amber-200 bg-white text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                                        onClick={() => void handleUpdateStatus(req)}
                                                                        disabled={statusIsSaving || (draftStatus ?? "") === reqStatus}
                                                                    >
                                                                        {statusIsSaving ? (
                                                                            <>
                                                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                                Updating…
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                                                Update
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-[0.75rem] text-foreground">
                                                                <div className="font-medium">{preferredDate}</div>
                                                                <div className="text-muted-foreground">
                                                                    {preferredTime !== "—" ? preferredTime : "—"}
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-[0.75rem] text-foreground">
                                                                <div className="font-medium">{finalDate}</div>
                                                                <div className="text-muted-foreground">
                                                                    {finalTime !== "—" ? finalTime : "—"}
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-[0.7rem] text-muted-foreground">{created}</div>
                                                        </TableCell>

                                                        <TableCell className="align-top text-right">
                                                            <div className="flex flex-col items-end gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 w-full border-amber-200 bg-white text-[0.7rem] text-amber-900 hover:bg-amber-50 sm:w-auto"
                                                                    onClick={() => openScheduleDialog(req)}
                                                                >
                                                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                                    {reqStatus === "scheduled" ? "Reschedule" : "Schedule"}
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 w-full border-red-200 bg-white text-[0.7rem] text-red-700 hover:bg-red-50 sm:w-auto"
                                                                    onClick={() => askDelete(req)}
                                                                    disabled={isDeleting}
                                                                >
                                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Pagination controls */}
                            {meta.total > 0 && (
                                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-[0.7rem] text-muted-foreground">
                                        Rows per page: <span className="font-medium text-foreground">{PER_PAGE}</span>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={!canPrev || isLoading}
                                        >
                                            Prev
                                        </Button>

                                        <div className="min-w-[120px] text-center text-[0.7rem] text-muted-foreground">
                                            Page <span className="font-medium text-foreground">{page}</span> of{" "}
                                            <span className="font-medium text-foreground">{meta.last_page}</span>
                                        </div>

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
                                            onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                            disabled={!canNext || isLoading}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ✅ Schedule Dialog */}
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogContent className="w-full max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Set final schedule</DialogTitle>
                        <DialogDescription className="text-xs">
                            Final schedule is counselor-confirmed. Student preferred schedule stays unchanged.
                        </DialogDescription>
                    </DialogHeader>

                    {scheduleTarget ? (
                        <div className="space-y-3">
                            <div className="rounded-md border bg-muted/40 p-3 text-xs">
                                <div className="font-medium text-foreground">{getStudentDisplayName(scheduleTarget)}</div>
                                <div className="mt-1 text-[0.7rem] text-muted-foreground">
                                    Preferred:{" "}
                                    <span className="font-medium text-foreground">
                                        {formatDate(scheduleTarget.preferred_date ?? undefined)}
                                    </span>{" "}
                                    {scheduleTarget.preferred_time ? `· ${String(scheduleTarget.preferred_time)}` : ""}
                                </div>
                                <div className="text-[0.7rem] text-muted-foreground">
                                    Current Final:{" "}
                                    <span className="font-medium text-foreground">
                                        {formatDate(getFinalDate(scheduleTarget) ?? undefined)}
                                    </span>{" "}
                                    {getFinalTime(scheduleTarget) ? `· ${String(getFinalTime(scheduleTarget))}` : ""}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <p className="text-[0.7rem] font-medium text-foreground">Final date</p>
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
                                                onSelect={(d) => setEditDate(d ?? undefined)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[0.7rem] font-medium text-foreground">Final time</p>
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
                        </div>
                    ) : null}

                    <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <div className="flex w-full gap-2 sm:w-auto">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    if (scheduleTarget) applyStudentPreferred(scheduleTarget)
                                }}
                                disabled={!scheduleTarget || isSaving}
                            >
                                Use student preferred
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={closeScheduleDialog}
                                disabled={isSaving}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                        </div>

                        <Button type="button" onClick={() => void saveSchedule()} disabled={!scheduleTarget || isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save final schedule
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ✅ Student Profile + History Dialog */}
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                <DialogContent className="w-full max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center justify-between gap-2">
                            <span>Student Profile</span>

                            {/* ✅ FIX: profileStudentId is now USED here, so no unused var warning */}
                            <Badge variant="secondary" className="text-[0.7rem]">
                                Internal User ID: {profileStudentId ?? "—"}
                            </Badge>
                        </DialogTitle>

                        <DialogDescription className="text-xs">
                            View student basic profile and counseling appointment history (counselor-only).
                        </DialogDescription>
                    </DialogHeader>

                    {profileLoading ? (
                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading student profile…
                        </div>
                    ) : profileError ? (
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-800">
                            <AlertCircle className="mt-px h-3.5 w-3.5" />
                            <div>
                                <p className="font-medium">Unable to load student profile.</p>
                                <p className="text-[0.7rem] opacity-90">{profileError}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-md border bg-muted/30 p-3">
                                <div className="text-sm font-semibold text-foreground">{profileData?.name ?? "—"}</div>

                                <div className="mt-1 grid gap-2 text-[0.75rem] text-muted-foreground sm:grid-cols-2">
                                    <div>
                                        <span className="font-medium text-foreground">Email:</span>{" "}
                                        {profileData?.email ?? "—"}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">Gender:</span>{" "}
                                        {profileData?.gender ?? "—"}
                                    </div>

                                    {/* ✅ also show Student/User identifiers safely */}
                                    <div>
                                        <span className="font-medium text-foreground">Student ID:</span>{" "}
                                        {profileData?.student_id ?? "—"}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">Internal User ID:</span>{" "}
                                        {profileStudentId ?? "—"}
                                    </div>

                                    <div>
                                        <span className="font-medium text-foreground">Year level:</span>{" "}
                                        {profileData?.year_level ?? "—"}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">Program:</span>{" "}
                                        {profileData?.program ?? "—"}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">Course:</span>{" "}
                                        {profileData?.course ?? "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-foreground">Student History</div>
                                <Badge variant="secondary" className="text-[0.7rem]">
                                    Total appointments:{" "}
                                    {historyData?.total_appointments ?? historyData?.appointments?.length ?? 0}
                                </Badge>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <ShadTableHeader>
                                        <TableRow>
                                            <TableHead className="w-[180px]">Created</TableHead>
                                            <TableHead>Concern</TableHead>
                                            <TableHead className="w-40">Status</TableHead>
                                            <TableHead className="w-[220px]">Final schedule</TableHead>
                                        </TableRow>
                                    </ShadTableHeader>
                                    <TableBody>
                                        {(Array.isArray(historyData?.appointments) ? historyData.appointments : [])
                                            .slice(0, 10)
                                            .map((r: any) => (
                                                <TableRow key={String(r?.id ?? Math.random())}>
                                                    <TableCell className="text-[0.75rem] text-muted-foreground">
                                                        {formatDateTime(r?.created_at ?? null)}
                                                    </TableCell>
                                                    <TableCell className="text-[0.75rem] text-foreground">
                                                        {formatConcernType(r?.concern_type ?? null)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={`w-fit rounded-full border px-2 py-0.5 text-[0.65rem] ${statusClassName(
                                                                r?.status ?? "pending",
                                                            )}`}
                                                        >
                                                            {String(r?.status ?? "pending")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-[0.75rem] text-muted-foreground">
                                                        <span className="font-medium text-foreground">
                                                            {formatDate(r?.scheduled_date ?? null)}
                                                        </span>{" "}
                                                        {r?.scheduled_time ? `· ${String(r.scheduled_time)}` : ""}
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                        {(!historyData?.appointments || historyData?.appointments?.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                                                    No history records found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <p className="text-[0.7rem] text-muted-foreground">Showing the latest 10 history records.</p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ✅ Delete confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base">Delete this appointment/request?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            You are about to delete the record for{" "}
                            <span className="font-medium text-foreground">
                                {deleteTarget ? getStudentDisplayName(deleteTarget) : "this student"}
                            </span>
                            . This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                void confirmDelete()
                            }}
                            disabled={isDeleting}
                            className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}

export default CounselorAppointments
