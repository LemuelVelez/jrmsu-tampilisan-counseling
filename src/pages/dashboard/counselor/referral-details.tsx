/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowLeft,
    Save,
    RefreshCw,
    UserCircle2,
    BadgeInfo,
    Calendar,
    Clock,
    Trash2,
} from "lucide-react"

import DashboardLayout from "@/components/DashboardLayout"
import { cn } from "@/lib/utils"

import { fetchCounselorReferralById, updateCounselorReferral } from "@/lib/referrals"
import { getCurrentSession } from "@/lib/authentication"
import { AUTH_API_BASE_URL } from "@/api/auth/route"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

type ReferralStatus = "pending" | "handled" | "closed" | string

type UserMini = {
    id: number | string
    name?: string | null
    email?: string | null
    role?: string | null
}

type ReferralView = {
    id: number | string
    status: ReferralStatus
    concern_type?: string | null
    urgency?: string | null
    details?: string | null

    remarks?: string | null
    handled_at?: string | null
    closed_at?: string | null

    // ✅ Appointment (counselor sets this)
    scheduled_date?: string | null // YYYY-MM-DD
    scheduled_time?: string | null // e.g. "8:00 AM" or "14:30"

    created_at?: string | null
    updated_at?: string | null

    student?: UserMini | null
    requestedBy?: UserMini | null
    counselor?: UserMini | null

    student_name?: string | null
    student_email?: string | null

    requested_by_name?: string | null
    requested_by_role?: string | null
    requested_by_email?: string | null
}

type DirectoryUser = {
    id: number | string
    name?: string | null
    email?: string | null
    role?: string | null
}

function safeStr(v: unknown) {
    return typeof v === "string" ? v : v == null ? "" : String(v)
}

function pad2(n: number) {
    return String(n).padStart(2, "0")
}

function timeToLabel(value: string) {
    // expects HH:mm (24h) but will gracefully fallback
    const v = String(value || "").trim()
    const m = v.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return v

    let hh = Number(m[1])
    const mm = Number(m[2])
    if (Number.isNaN(hh) || Number.isNaN(mm)) return v

    const ampm = hh >= 12 ? "PM" : "AM"
    hh = hh % 12
    if (hh === 0) hh = 12
    return `${hh}:${pad2(mm)} ${ampm}`
}

function normalizeTimeToHHmm(input?: string | null): string {
    const raw = String(input || "").trim()
    if (!raw) return ""

    // 24h: 14:30
    const m24 = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (m24) {
        const h = Number(m24[1])
        const m = Number(m24[2])
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${pad2(h)}:${pad2(m)}`
        return raw
    }

    // 12h: 8:00 AM / 08:00 pm
    const m12 = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
    if (m12) {
        let h = Number(m12[1])
        const m = Number(m12[2])
        const ap = String(m12[3]).toLowerCase()

        if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
            if (ap === "pm" && h !== 12) h += 12
            if (ap === "am" && h === 12) h = 0
            return `${pad2(h)}:${pad2(m)}`
        }
        return raw
    }

    // 12h without minutes: 8 AM
    const m12h = raw.match(/^(\d{1,2})\s*(am|pm)$/i)
    if (m12h) {
        let h = Number(m12h[1])
        const ap = String(m12h[2]).toLowerCase()
        if (h >= 1 && h <= 12) {
            if (ap === "pm" && h !== 12) h += 12
            if (ap === "am" && h === 12) h = 0
            return `${pad2(h)}:00`
        }
        return raw
    }

    // unknown format: keep as-is (still saved), but Select may not show a label
    return raw
}

function buildTimeOptions(params?: { startHour?: number; endHour?: number; stepMinutes?: number }) {
    const startHour = params?.startHour ?? 8
    const endHour = params?.endHour ?? 17
    const stepMinutes = params?.stepMinutes ?? 30

    const out: Array<{ value: string; label: string }> = []
    for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += stepMinutes) {
            // endHour includes the whole hour (e.g. 17:00, 17:30 if step allows)
            if (h === endHour && m > 0) continue
            const value = `${pad2(h)}:${pad2(m)}`
            out.push({ value, label: timeToLabel(value) })
        }
    }
    return out
}

const TIME_OPTIONS = buildTimeOptions({ startHour: 8, endHour: 17, stepMinutes: 30 })

function toDateTimeLabel(value?: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    const t = d.getTime()
    if (Number.isNaN(t)) return value
    return d.toLocaleString()
}

function toDateOnlyLabel(value?: string | null) {
    if (!value) return "—"
    // supports YYYY-MM-DD or ISO
    const d = new Date(value)
    const t = d.getTime()
    if (Number.isNaN(t)) return value
    return d.toLocaleDateString()
}

function normalizeUserMini(raw: any): UserMini | null {
    if (!raw) return null
    return {
        id: raw?.id ?? "",
        name: raw?.name ?? null,
        email: raw?.email ?? null,
        role: raw?.role ?? null,
    }
}

function normalizeReferral(raw: any): ReferralView {
    const student = normalizeUserMini(raw?.student) ?? null
    const requestedBy =
        normalizeUserMini(raw?.requested_by) ??
        normalizeUserMini(raw?.requestedBy) ??
        null
    const counselor = normalizeUserMini(raw?.counselor) ?? null

    // ✅ appointment fallbacks (just in case backend uses different naming)
    const scheduledDate =
        raw?.scheduled_date ??
        raw?.appointment_date ??
        raw?.schedule_date ??
        raw?.counseling_date ??
        null

    const scheduledTime =
        raw?.scheduled_time ??
        raw?.appointment_time ??
        raw?.schedule_time ??
        raw?.counseling_time ??
        null

    return {
        id: raw?.id ?? "",
        status: raw?.status ?? "pending",
        concern_type: raw?.concern_type ?? raw?.concern ?? null,
        urgency: raw?.urgency ?? null,
        details: raw?.details ?? null,

        remarks: raw?.remarks ?? null,
        handled_at: raw?.handled_at ?? null,
        closed_at: raw?.closed_at ?? null,

        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,

        created_at: raw?.created_at ?? null,
        updated_at: raw?.updated_at ?? null,

        student,
        requestedBy,
        counselor,

        student_name: raw?.student_name ?? null,
        student_email: raw?.student_email ?? null,

        requested_by_name: raw?.requested_by_name ?? null,
        requested_by_role: raw?.requested_by_role ?? null,
        requested_by_email: raw?.requested_by_email ?? null,
    }
}

function trimSlash(s: string) {
    return s.replace(/\/+$/, "")
}

function resolveLaravelBaseUrl(): string {
    const env = (import.meta as any)?.env ?? {}

    const fromEnv =
        env?.VITE_API_LARAVEL_BASE_URL ||
        env?.VITE_LARAVEL_API_BASE_URL ||
        env?.VITE_API_BASE_URL ||
        ""

    const fromAuthConst = typeof AUTH_API_BASE_URL === "string" ? AUTH_API_BASE_URL : ""

    const raw = String(fromEnv || fromAuthConst || "").trim()

    if (raw) return trimSlash(raw)

    // ✅ dev-friendly fallback (prevents the app from crashing if env isn't injected)
    // Only applies on localhost to avoid breaking production accidentally.
    const isDev = Boolean(env?.DEV)
    const onLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

    if (isDev && onLocalhost) return "http://localhost:8000"

    return ""
}

function getSessionToken(): string | null {
    try {
        const session = getCurrentSession() as any
        return session?.token ?? session?.access_token ?? null
    } catch {
        return null
    }
}

async function fetchCounselorsDirectory(search?: string): Promise<DirectoryUser[]> {
    const qs = new URLSearchParams()
    qs.set("role", "counselor")
    qs.set("limit", "50")
    if (search && search.trim()) qs.set("search", search.trim())

    const base = resolveLaravelBaseUrl()

    if (!base) {
        throw new Error(
            [
                "VITE_API_LARAVEL_BASE_URL is not defined.",
                "Fix:",
                "1) Put your frontend .env in the Vite project root (same level as package.json).",
                "2) Ensure it is named exactly .env (or .env.development).",
                "3) Restart the Vite dev server after editing env vars.",
                "Expected: VITE_API_LARAVEL_BASE_URL=http://localhost:8000",
            ].join("\n"),
        )
    }

    const url = `${base}/counselor/users?${qs.toString()}`

    const headers = new Headers()
    headers.set("Accept", "application/json")

    const token = getSessionToken()
    if (token) {
        headers.set("Authorization", `Bearer ${token}`)
    }

    const res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
    })

    const text = await res.text()
    let data: any = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = text
    }

    if (!res.ok) {
        const msg =
            data?.message ||
            data?.error ||
            (typeof data === "string" && data ? data.slice(0, 220) : "") ||
            res.statusText ||
            "Failed to fetch counselors."
        throw new Error(msg)
    }

    const users = Array.isArray(data?.users) ? data.users : []
    return users.map((u: any) => ({
        id: u?.id ?? "",
        name: u?.name ?? null,
        email: u?.email ?? null,
        role: u?.role ?? null,
    }))
}

function statusBadge(status: ReferralStatus) {
    const s = safeStr(status).toLowerCase()

    if (s === "pending")
        return (
            <Badge variant="secondary" className="capitalize">
                pending
            </Badge>
        )
    if (s === "handled")
        return <Badge className="capitalize">handled</Badge>
    if (s === "closed")
        return (
            <Badge variant="destructive" className="capitalize">
                closed
            </Badge>
        )

    return <Badge variant="outline">{safeStr(status) || "unknown"}</Badge>
}

function hasAppointment(date?: string | null, time?: string | null) {
    return Boolean((date && String(date).trim()) || (time && String(time).trim()))
}

function appointmentComplete(date?: string | null, time?: string | null) {
    return Boolean(date && String(date).trim() && time && String(time).trim())
}

function appointmentLabel(date?: string | null, time?: string | null) {
    if (!date && !time) return "—"
    const d = date ? toDateOnlyLabel(date) : "—"
    const t = time ? timeToLabel(normalizeTimeToHHmm(time)) : "—"
    if (date && time) return `${d} • ${t}`
    if (date) return `${d} • (time missing)`
    return `— • ${t}`
}

export default function CounselorReferralDetailsPage() {
    const navigate = useNavigate()
    const params = useParams()
    const [searchParams] = useSearchParams()

    const idFromParams = params?.id ? String(params.id) : ""
    const idFromQuery = searchParams.get("id") ? String(searchParams.get("id")) : ""
    const id = (idFromParams || idFromQuery || "").trim()

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [referral, setReferral] = React.useState<ReferralView | null>(null)

    const [status, setStatus] = React.useState<ReferralStatus>("pending")
    const [remarks, setRemarks] = React.useState<string>("")

    // ✅ Appointment state (CRUD)
    const [scheduledDate, setScheduledDate] = React.useState<string>("")
    const [scheduledTime, setScheduledTime] = React.useState<string>("")

    const [assignedCounselorId, setAssignedCounselorId] = React.useState<string>("")
    const [assignDialogOpen, setAssignDialogOpen] = React.useState(false)

    const [counselorSearch, setCounselorSearch] = React.useState("")
    const [counselorLoading, setCounselorLoading] = React.useState(false)
    const [counselors, setCounselors] = React.useState<DirectoryUser[]>([])

    const load = React.useCallback(async () => {
        if (!id) {
            setReferral(null)
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const raw = await fetchCounselorReferralById(id)
            const data = normalizeReferral(raw)
            setReferral(data)

            setStatus(data.status ?? "pending")
            setRemarks(data.remarks ?? "")

            // ✅ load appointment fields
            setScheduledDate(data.scheduled_date ? String(data.scheduled_date) : "")
            setScheduledTime(data.scheduled_time ? normalizeTimeToHHmm(String(data.scheduled_time)) : "")

            const currentCounselorId = data.counselor?.id ? String(data.counselor.id) : ""
            setAssignedCounselorId(currentCounselorId)
        } catch (err: any) {
            toast.error(err?.message || "Failed to load referral.")
        } finally {
            setLoading(false)
        }
    }, [id])

    const refresh = React.useCallback(async () => {
        if (!id) return
        setRefreshing(true)
        try {
            const raw = await fetchCounselorReferralById(id)
            const data = normalizeReferral(raw)
            setReferral(data)
            setStatus(data.status ?? "pending")
            setRemarks(data.remarks ?? "")

            // ✅ refresh appointment fields
            setScheduledDate(data.scheduled_date ? String(data.scheduled_date) : "")
            setScheduledTime(data.scheduled_time ? normalizeTimeToHHmm(String(data.scheduled_time)) : "")

            const currentCounselorId = data.counselor?.id ? String(data.counselor.id) : ""
            setAssignedCounselorId(currentCounselorId)
        } catch {
            // silent
        } finally {
            setRefreshing(false)
        }
    }, [id])

    React.useEffect(() => {
        load()
    }, [load])

    const openAssignDialog = React.useCallback(async () => {
        setAssignDialogOpen(true)

        setCounselorLoading(true)
        try {
            const list = await fetchCounselorsDirectory("")
            setCounselors(list)
        } catch (err: any) {
            toast.error(err?.message || "Failed to load counselors.")
        } finally {
            setCounselorLoading(false)
        }
    }, [])

    const searchCounselors = React.useCallback(async () => {
        setCounselorLoading(true)
        try {
            const list = await fetchCounselorsDirectory(counselorSearch)
            setCounselors(list)
        } catch (err: any) {
            toast.error(err?.message || "Failed to search counselors.")
        } finally {
            setCounselorLoading(false)
        }
    }, [counselorSearch])

    const saveChanges = React.useCallback(async () => {
        if (!referral?.id) return

        const date = scheduledDate?.trim?.() ? scheduledDate.trim() : ""
        const time = scheduledTime?.trim?.() ? scheduledTime.trim() : ""

        // ✅ enforce "both or none"
        if ((date && !time) || (!date && time)) {
            toast.error("Please provide BOTH scheduled date and scheduled time.")
            return
        }

        // ✅ if counselor sets appointment, referral becomes handled automatically
        const currentStatusLower = String(status || "").toLowerCase()
        const shouldAutoHandle = Boolean(date && time && currentStatusLower === "pending")
        const nextStatus: ReferralStatus = shouldAutoHandle ? "handled" : status

        if (shouldAutoHandle) {
            // reflect immediately in UI (so user sees what will happen)
            setStatus("handled")
            toast.message("Appointment set — status will be marked as handled.")
        }

        try {
            const payload: any = {
                status: String(nextStatus || "").trim() || undefined,
                remarks: remarks?.trim?.() ? remarks.trim() : null,
                counselor_id: assignedCounselorId ? assignedCounselorId : null,

                // ✅ appointment fields (set or clear)
                scheduled_date: date ? date : null,
                scheduled_time: time ? time : null, // HH:mm
            }

            const updatedRaw = await updateCounselorReferral(referral.id, payload)
            const updated = normalizeReferral(updatedRaw)

            setReferral(updated)

            setStatus(updated.status ?? nextStatus)
            setRemarks(updated.remarks ?? remarks)

            // ✅ keep appointment fields in sync with backend response
            setScheduledDate(updated.scheduled_date ? String(updated.scheduled_date) : "")
            setScheduledTime(updated.scheduled_time ? normalizeTimeToHHmm(String(updated.scheduled_time)) : "")

            const currentCounselorId = updated.counselor?.id ? String(updated.counselor.id) : ""
            setAssignedCounselorId(currentCounselorId)

            toast.success("Referral updated successfully.")
        } catch (err: any) {
            toast.error(err?.message || "Failed to update referral.")
        }
    }, [assignedCounselorId, referral?.id, remarks, scheduledDate, scheduledTime, status])

    const studentName = referral?.student?.name ?? referral?.student_name ?? "—"
    const studentEmail = referral?.student?.email ?? referral?.student_email ?? null
    const requestedByName = referral?.requestedBy?.name ?? referral?.requested_by_name ?? "—"
    const requestedByRole = referral?.requestedBy?.role ?? referral?.requested_by_role ?? null
    const requestedByEmail = referral?.requestedBy?.email ?? referral?.requested_by_email ?? null

    const currentCounselorName = referral?.counselor?.name ?? null
    const currentCounselorEmail = referral?.counselor?.email ?? null

    const apptHasAny = hasAppointment(scheduledDate, scheduledTime)
    const apptIsComplete = appointmentComplete(scheduledDate, scheduledTime)

    return (
        <DashboardLayout
            title="Referral Details"
            description="View referral information, Requested By, and update status, appointment, or assign a counselor."
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refresh}
                            disabled={refreshing || loading}
                            className="gap-2"
                        >
                            <RefreshCw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
                            Refresh
                        </Button>
                    </div>

                    <Button variant="link" asChild className="px-0 text-muted-foreground hover:text-foreground">
                        <Link to="/dashboard/counselor/referrals">Go to Referrals List</Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader className="gap-1">
                        <CardTitle className="flex items-center gap-2">
                            Referral #{id || "—"}
                            {referral ? statusBadge(referral.status) : null}
                        </CardTitle>
                        <CardDescription>Includes Student, Requested By, appointment, and assignment details.</CardDescription>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : !referral ? (
                            <div className="rounded-lg border bg-muted/30 p-6 text-center">
                                <div className="text-sm font-medium">Referral not found</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    The referral may have been deleted or you don&apos;t have access.
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-3">
                                <Card className="lg:col-span-1">
                                    <CardHeader>
                                        <CardTitle className="text-base">People</CardTitle>
                                        <CardDescription>Student + Requested By + Assigned counselor.</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                                                <div className="font-medium">Student</div>
                                            </div>
                                            <div className="mt-2 space-y-0.5">
                                                <div className="text-sm font-semibold">{studentName}</div>
                                                <div className="text-xs text-muted-foreground">{studentEmail || "—"}</div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-3">
                                            <div className="flex items-center gap-2">
                                                <BadgeInfo className="h-4 w-4 text-muted-foreground" />
                                                <div className="font-medium">Requested By</div>
                                            </div>

                                            <div className="mt-2 space-y-0.5">
                                                <div className="text-sm font-semibold">{requestedByName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {requestedByRole ? <span className="capitalize">{requestedByRole}</span> : "—"}
                                                    {requestedByEmail ? <span className="ml-2">• {requestedByEmail}</span> : null}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border p-3">
                                            <div className="font-medium">Assigned Counselor</div>
                                            <div className="mt-2 space-y-0.5">
                                                <div className="text-sm font-semibold">{currentCounselorName || "Not assigned"}</div>
                                                <div className="text-xs text-muted-foreground">{currentCounselorEmail || "—"}</div>

                                                <div className="mt-3">
                                                    <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm" onClick={openAssignDialog}>
                                                                Assign / Change
                                                            </Button>
                                                        </DialogTrigger>

                                                        <DialogContent className="max-w-xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Assign Counselor</DialogTitle>
                                                                <DialogDescription>
                                                                    Select a counselor user to handle this referral (or leave unassigned).
                                                                </DialogDescription>
                                                            </DialogHeader>

                                                            <div className="space-y-3">
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                                                    <div className="flex-1 space-y-1">
                                                                        <Label htmlFor="counselorSearch">Search counselors</Label>
                                                                        <Input
                                                                            id="counselorSearch"
                                                                            value={counselorSearch}
                                                                            onChange={(e) => setCounselorSearch(e.target.value)}
                                                                            placeholder="Type name or email..."
                                                                        />
                                                                    </div>

                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={searchCounselors}
                                                                        disabled={counselorLoading}
                                                                    >
                                                                        Search
                                                                    </Button>
                                                                </div>

                                                                <Separator />

                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-sm text-muted-foreground">
                                                                        {counselorLoading ? "Loading..." : `${counselors.length} counselor(s)`}
                                                                    </div>

                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setAssignedCounselorId("")
                                                                            toast.message("Counselor cleared (not saved yet).")
                                                                            setAssignDialogOpen(false)
                                                                        }}
                                                                    >
                                                                        Unassign
                                                                    </Button>
                                                                </div>

                                                                <ScrollArea className="h-80 rounded-lg border">
                                                                    {counselorLoading ? (
                                                                        <div className="space-y-2 p-3">
                                                                            <Skeleton className="h-10 w-full" />
                                                                            <Skeleton className="h-10 w-full" />
                                                                            <Skeleton className="h-10 w-full" />
                                                                        </div>
                                                                    ) : counselors.length === 0 ? (
                                                                        <div className="p-4 text-sm text-muted-foreground">
                                                                            No counselors found.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="divide-y">
                                                                            {counselors.map((c) => {
                                                                                const isSelected = assignedCounselorId === String(c.id)
                                                                                return (
                                                                                    <Button
                                                                                        key={String(c.id)}
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        className={cn(
                                                                                            "h-auto w-full justify-start rounded-none px-3 py-3 text-left hover:bg-muted/40",
                                                                                            isSelected ? "bg-muted/40" : "",
                                                                                        )}
                                                                                        onClick={() => {
                                                                                            setAssignedCounselorId(String(c.id))
                                                                                            toast.message("Counselor selected (not saved yet).")
                                                                                            setAssignDialogOpen(false)
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex w-full items-start justify-between gap-3">
                                                                                            <div className="min-w-0">
                                                                                                <div className="truncate text-sm font-medium">{c.name || "—"}</div>
                                                                                                <div className="truncate text-xs text-muted-foreground">
                                                                                                    {c.email || "—"}
                                                                                                </div>
                                                                                            </div>

                                                                                            {isSelected ? <Badge variant="outline">Selected</Badge> : null}
                                                                                        </div>
                                                                                    </Button>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </ScrollArea>

                                                                <div className="text-xs text-muted-foreground">
                                                                    Tip: click <span className="font-medium">Save changes</span> to apply assignment.
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">Referral Information</CardTitle>
                                        <CardDescription>
                                            Set an appointment, write remarks, and update status.
                                            <span className="ml-1 font-medium">
                                                Setting an appointment will automatically mark the referral as handled.
                                            </span>
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label>Concern Type</Label>
                                                <Input value={referral.concern_type || ""} readOnly />
                                            </div>

                                            <div className="space-y-1">
                                                <Label>Urgency</Label>
                                                <Input value={referral.urgency || ""} readOnly />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label>Details</Label>
                                            <Textarea value={referral.details || ""} readOnly className="min-h-32" />
                                        </div>

                                        <Separator />

                                        {/* ✅ Appointment CRUD */}
                                        <div className="rounded-lg border p-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <div className="text-sm font-medium">Appointment</div>
                                                        {apptIsComplete ? (
                                                            <Badge variant="outline" className="font-normal">
                                                                Set
                                                            </Badge>
                                                        ) : apptHasAny ? (
                                                            <Badge variant="destructive" className="font-normal">
                                                                Incomplete
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="font-normal">
                                                                Not set
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Current: {appointmentLabel(scheduledDate || null, scheduledTime || null)}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        setScheduledDate("")
                                                        setScheduledTime("")
                                                        toast.message("Appointment cleared (not saved yet).")
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Clear
                                                </Button>
                                            </div>

                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1">
                                                    <Label htmlFor="scheduled_date">Scheduled Date</Label>
                                                    <Input
                                                        id="scheduled_date"
                                                        type="date"
                                                        value={scheduledDate}
                                                        onChange={(e) => setScheduledDate(e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor="scheduled_time" className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        Scheduled Time
                                                    </Label>

                                                    {/* ✅ Shadcn Select for convenience */}
                                                    <Select value={scheduledTime} onValueChange={(v) => setScheduledTime(v)}>
                                                        <SelectTrigger id="scheduled_time">
                                                            <SelectValue placeholder="Select time" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {TIME_OPTIONS.map((t) => (
                                                                <SelectItem key={t.value} value={t.value}>
                                                                    {t.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="mt-2 text-xs text-muted-foreground">
                                                Note: Date & time must both be filled. When set, the referral is automatically marked as{" "}
                                                <span className="font-medium">handled</span>.
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label>Status</Label>
                                                <Select value={String(status)} onValueChange={(v) => setStatus(v)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="handled">Handled</SelectItem>
                                                        <SelectItem value="closed">Closed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1">
                                                <Label>Assigned Counselor ID</Label>
                                                <Input value={assignedCounselorId || ""} readOnly placeholder="Not assigned" />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label>Remarks (Counselor notes)</Label>
                                            <Textarea
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                placeholder="Add remarks, actions taken, follow-ups..."
                                                className="min-h-28"
                                            />
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg border p-3">
                                                <div className="text-xs text-muted-foreground">Created</div>
                                                <div className="text-sm font-medium">{toDateTimeLabel(referral.created_at)}</div>
                                            </div>

                                            <div className="rounded-lg border p-3">
                                                <div className="text-xs text-muted-foreground">Last Updated</div>
                                                <div className="text-sm font-medium">{toDateTimeLabel(referral.updated_at)}</div>
                                            </div>

                                            <div className="rounded-lg border p-3">
                                                <div className="text-xs text-muted-foreground">Handled At</div>
                                                <div className="text-sm font-medium">{toDateTimeLabel(referral.handled_at)}</div>
                                            </div>

                                            <div className="rounded-lg border p-3">
                                                <div className="text-xs text-muted-foreground">Closed At</div>
                                                <div className="text-sm font-medium">{toDateTimeLabel(referral.closed_at)}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setStatus(referral.status ?? "pending")
                                                    setRemarks(referral.remarks ?? "")

                                                    // reset appointment fields
                                                    setScheduledDate(referral.scheduled_date ? String(referral.scheduled_date) : "")
                                                    setScheduledTime(
                                                        referral.scheduled_time ? normalizeTimeToHHmm(String(referral.scheduled_time)) : "",
                                                    )

                                                    const currentCounselorId = referral.counselor?.id ? String(referral.counselor.id) : ""
                                                    setAssignedCounselorId(currentCounselorId)
                                                    toast.message("Changes reset.")
                                                }}
                                            >
                                                Reset
                                            </Button>

                                            <Button onClick={saveChanges} className="gap-2">
                                                <Save className="h-4 w-4" />
                                                Save changes
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
