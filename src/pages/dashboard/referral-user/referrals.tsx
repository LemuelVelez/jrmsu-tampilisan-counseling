/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import DashboardLayout from "@/components/DashboardLayout"
import { getCurrentSession } from "@/lib/authentication"
import { createReferralApi, type ReferralDto } from "@/api/referrals/route"
import { fetchReferralUserReferrals } from "@/lib/referrals"

import { cn } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter as AlertDialogFooterUi,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    Check,
    ChevronsUpDown,
    Eye,
    Loader2,
    MoreVertical,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    CalendarClock,
} from "lucide-react"

type ReferralStatus = "pending" | "handled" | "closed" | string
type Urgency = "low" | "medium" | "high"

type DirectoryStudent = {
    /** internal users.id (primary key) */
    id: number | string
    /** actual student number from users.student_id */
    studentId?: string | null
    name: string
    email?: string | null
    role?: string | null
}

type UiReferral = {
    id: number | string

    /** Display Student ID (users.student_id), NOT users.id */
    studentId: string
    studentName: string
    studentEmail?: string | null

    concernType: string
    urgency: Urgency | string
    details: string

    status: ReferralStatus

    remarks?: string | null
    handledAt?: string | null
    closedAt?: string | null

    counselorName?: string | null
    counselorEmail?: string | null

    // ✅ Appointment (read-only for referral user)
    scheduledDate?: string | null // e.g. "2026-02-06"
    scheduledTime?: string | null // e.g. "09:00" or "9:00 AM"

    requestedByName: string
    requestedByRole: string

    createdAt?: string
    updatedAt?: string
}

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined

function resolveApiUrl(path: string): string {
    if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.")
    const trimmed = path.replace(/^\/+/, "")
    return `${API_BASE_URL}/${trimmed}`
}

function safeText(v: any, fallback = ""): string {
    if (v === null || v === undefined) return fallback
    const s = String(v).trim()
    return s || fallback
}

function safeLower(v: any): string {
    return safeText(v).toLowerCase()
}

function safeDateShort(iso?: string | null) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "MMM d, yyyy")
}

function safeDateTime(iso?: string | null) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "MMM d, yyyy • h:mm a")
}

// ✅ Date-only safe formatter (handles YYYY-MM-DD without timezone shift)
function safeDateOnly(value?: string | null) {
    if (!value) return ""
    const s = String(value).trim()
    if (!s) return ""

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
        const y = Number(m[1])
        const mo = Number(m[2]) - 1
        const d = Number(m[3])
        const local = new Date(y, mo, d)
        if (!Number.isNaN(local.getTime())) return format(local, "MMM d, yyyy")
        return s
    }

    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s
    return format(dt, "MMM d, yyyy")
}

// ✅ Time-only formatter -> always show AM/PM when possible (09:00 -> 9:00 AM, 14:30 -> 2:30 PM)
function safeTimeWithAmPm(value?: string | null) {
    const raw = safeText(value)
    if (!raw) return ""
    const cleaned = raw.replace(/\s+/g, " ").trim()

    // Match: H:MM, HH:MM, with optional :SS and optional AM/PM
    const m = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
    if (!m) return cleaned

    let hour = Number(m[1])
    const minute = Number(m[2])
    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return cleaned

    const hasMeridiem = !!m[4]
    const mer = (m[4] || "").toUpperCase()

    // Interpret hour based on whether AM/PM is present
    if (hasMeridiem) {
        // Treat as 12-hour input
        if (hour < 1 || hour > 12) return cleaned
        const isPm = mer === "PM"
        if (hour === 12) hour = isPm ? 12 : 0
        else hour = isPm ? hour + 12 : hour
    } else {
        // Treat as 24-hour input (commonly "09:00" or "14:30")
        if (hour < 0 || hour > 23) return cleaned
    }

    const period = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    const mm = String(minute).padStart(2, "0")
    return `${hour12}:${mm} ${period}`
}

function appointmentLabel(date?: string | null, time?: string | null) {
    const d = safeDateOnly(date) || ""
    const t = safeTimeWithAmPm(time) || ""
    if (!d && !t) return "—"
    if (d && t) return `${d} • ${t}`
    if (d) return `${d} • (time missing)`
    return `— • ${t}`
}

function toUiReferral(dto: ReferralDto): UiReferral {
    const anyDto = dto as any

    const displayStudentId =
        safeText(anyDto?.student?.student_id) ||
        safeText(anyDto?.student?.studentId) ||
        safeText(anyDto?.student_id) ||
        safeText(anyDto?.studentId) ||
        ""

    const studentName =
        safeText(anyDto?.student_name) ||
        safeText(anyDto?.student?.name) ||
        (displayStudentId ? `Student • ${displayStudentId}` : "Student")

    const studentEmail =
        safeText(anyDto?.student_email) ||
        safeText(anyDto?.student?.email) ||
        null

    const concernType =
        safeText(anyDto?.concern_type) ||
        safeText(anyDto?.concernType) ||
        safeText(anyDto?.concern) ||
        "N/A"

    const urgency =
        safeText(anyDto?.urgency) ||
        safeText(anyDto?.priority) ||
        "medium"

    const details =
        safeText(anyDto?.details) ||
        safeText(anyDto?.description) ||
        ""

    const status = (safeText(anyDto?.status, "pending") || "pending") as ReferralStatus

    const requestedByName =
        safeText(anyDto?.requested_by_name) ||
        safeText(anyDto?.requestedBy?.name) ||
        safeText(anyDto?.requested_by?.name) ||
        "You"

    const requestedByRole =
        safeText(anyDto?.requested_by_role) ||
        safeText(anyDto?.requestedBy?.role) ||
        safeText(anyDto?.requested_by?.role) ||
        "Referral User"

    const counselorName =
        safeText(anyDto?.counselor?.name) ||
        safeText(anyDto?.counselor_name) ||
        null

    const counselorEmail =
        safeText(anyDto?.counselor?.email) ||
        safeText(anyDto?.counselor_email) ||
        null

    const remarks = safeText(anyDto?.remarks) || null
    const handledAt = safeText(anyDto?.handled_at) || null
    const closedAt = safeText(anyDto?.closed_at) || null

    // ✅ Appointment fallbacks (matches counselor files)
    const scheduledDate =
        safeText(anyDto?.scheduled_date) ||
        safeText(anyDto?.appointment_date) ||
        safeText(anyDto?.schedule_date) ||
        safeText(anyDto?.counseling_date) ||
        null

    const scheduledTime =
        safeText(anyDto?.scheduled_time) ||
        safeText(anyDto?.appointment_time) ||
        safeText(anyDto?.schedule_time) ||
        safeText(anyDto?.counseling_time) ||
        null

    return {
        id: dto.id,

        studentId: displayStudentId,
        studentName,
        studentEmail,

        concernType,
        urgency,
        details,

        status,

        remarks,
        handledAt,
        closedAt,
        counselorName,
        counselorEmail,

        // ✅ Appointment (read)
        scheduledDate,
        scheduledTime,

        requestedByName,
        requestedByRole,

        createdAt: safeText(anyDto?.created_at) || undefined,
        updatedAt: safeText(anyDto?.updated_at) || undefined,
    }
}

function statusBadgeVariant(status: string): "secondary" | "default" | "destructive" | "outline" {
    const s = safeLower(status)
    if (s === "pending") return "secondary"
    if (s === "handled") return "default"
    if (s === "closed") return "outline"
    return "secondary"
}

function urgencyBadgeVariant(urgency: string): "secondary" | "default" | "destructive" | "outline" {
    const u = safeLower(urgency)
    if (u === "high") return "destructive"
    if (u === "medium") return "default"
    if (u === "low") return "secondary"
    return "outline"
}

async function apiFetch(path: string, init: RequestInit, token?: string | null): Promise<any> {
    const url = resolveApiUrl(path)

    const res = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
        },
    })

    const text = await res.text()
    let data: any = null

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = text
        }
    }

    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText || "Server request failed."
        const err: any = new Error(msg)
        err.status = res.status
        err.data = data
        throw err
    }

    return data
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload

    const candidates = [payload.users, payload.data, payload.results, payload.items, payload.records]
    for (const c of candidates) {
        if (Array.isArray(c)) return c
    }
    return []
}

/**
 * ✅ Student Search
 */
async function trySearchStudents(query: string, token?: string | null): Promise<DirectoryStudent[]> {
    const q = query.trim()
    const qq = encodeURIComponent(q)

    const candidates = [
        `/referral-user/students?search=${qq}&limit=50`,
        `/referral-user/users?role=student&search=${qq}&limit=50`,
        `/students?search=${qq}&limit=50`,
        `/users?role=student&search=${qq}&limit=50`,
    ]

    let lastErr: any = null

    for (const p of candidates) {
        try {
            const data = await apiFetch(p, { method: "GET" }, token)
            const arr = extractUsersArray(data)

            const mapped: DirectoryStudent[] = arr
                .map((raw: any) => raw?.user ?? raw)
                .map((u: any) => {
                    const userId = u?.id ?? u?.user_id
                    if (userId == null || String(userId).trim() === "") return null

                    const name =
                        safeText(u?.name) ||
                        safeText(u?.full_name) ||
                        safeText(u?.fullname) ||
                        "Unknown"

                    const email = safeText(u?.email) || null
                    const role = safeText(u?.role) || null
                    const studentId = safeText(u?.student_id) || safeText(u?.studentId) || null

                    return {
                        id: userId,
                        studentId,
                        name,
                        email,
                        role,
                    } as DirectoryStudent
                })
                .filter(Boolean) as DirectoryStudent[]

            const filtered = mapped.filter((u) => {
                if (!u.role) return true
                return safeLower(u.role).includes("student")
            })

            const seen = new Set<string>()
            return filtered.filter((u) => {
                const k = String(u.id)
                if (seen.has(k)) return false
                seen.add(k)
                return true
            })
        } catch (e: any) {
            lastErr = e
            if (e?.status === 403) throw e
        }
    }

    throw lastErr ?? new Error("Failed to search students.")
}

function StudentCombobox(props: {
    students: DirectoryStudent[]
    value: DirectoryStudent | null
    onChange: (u: DirectoryStudent) => void
    searchValue: string
    onSearchValueChange: (v: string) => void
    isLoading?: boolean
    disabled?: boolean
}) {
    const { students, value, onChange, searchValue, onSearchValueChange, isLoading, disabled } = props
    const [open, setOpen] = React.useState(false)

    const labelFor = (u: DirectoryStudent) => {
        const sid = safeText(u.studentId) || safeText(u.id)
        return `${u.name} • Student ID: ${sid}`
    }

    return (
        <Popover open={open} onOpenChange={(v) => (!disabled ? setOpen(v) : null)}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 w-full justify-between"
                    disabled={disabled}
                >
                    <span className={cn("min-w-0 truncate text-left", !value ? "text-muted-foreground" : "")}>
                        {value ? labelFor(value) : "Search student…"}
                    </span>
                    <ChevronsUpDown className="ml-4 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Type name / email / Student ID…"
                        value={searchValue}
                        onValueChange={(v) => onSearchValueChange(v)}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {isLoading
                                ? "Searching…"
                                : searchValue.trim().length < 2
                                    ? "Type at least 2 characters."
                                    : "No students found."}
                        </CommandEmpty>

                        <CommandGroup>
                            {students.map((u) => {
                                const selected = !!value && String(value.id) === String(u.id)
                                const sid = safeText(u.studentId) || safeText(u.id)

                                return (
                                    <CommandItem
                                        key={String(u.id)}
                                        value={`${u.name} ${u.email ?? ""} ${sid}`}
                                        onSelect={() => {
                                            onChange(u)
                                            setOpen(false)
                                        }}
                                        className="gap-2"
                                    >
                                        <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm">{u.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                Student ID: {sid}
                                                {u.email ? ` • ${u.email}` : ""}
                                            </div>
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const ReferralUserReferrals: React.FC = () => {
    const session = getCurrentSession()
    const token = (session as any)?.token ?? (session as any)?.access_token ?? null

    const myName = session?.user && (session.user as any).name ? String((session.user as any).name) : "Referral User"
    const myRole = session?.user && (session.user as any).role ? String((session.user as any).role) : "Referral User"

    const [isLoading, setIsLoading] = React.useState(true)
    const [isRefreshing, setIsRefreshing] = React.useState(false)

    const [rows, setRows] = React.useState<UiReferral[]>([])

    const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "handled" | "closed">("all")
    const [search, setSearch] = React.useState("")

    // ✅ Upsert (Create / Edit)
    const [upsertOpen, setUpsertOpen] = React.useState(false)
    const [upsertMode, setUpsertMode] = React.useState<"create" | "edit">("create")
    const [upsertBusy, setUpsertBusy] = React.useState(false)
    const [editingId, setEditingId] = React.useState<number | string | null>(null)

    // student selection (used by create/edit)
    const [studentMode, setStudentMode] = React.useState<"search" | "manual">("search")
    const [studentQuery, setStudentQuery] = React.useState("")
    const [studentLoading, setStudentLoading] = React.useState(false)
    const [studentResults, setStudentResults] = React.useState<DirectoryStudent[]>([])
    const [selectedStudent, setSelectedStudent] = React.useState<DirectoryStudent | null>(null)
    const [manualStudentId, setManualStudentId] = React.useState("")

    const [studentSearchBlocked, setStudentSearchBlocked] = React.useState(false)
    const studentSearchWarnedRef = React.useRef(false)

    // form fields
    const [concernType, setConcernType] = React.useState("")
    const [urgency, setUrgency] = React.useState<Urgency>("medium")
    const [details, setDetails] = React.useState("")

    // ✅ View (Read)
    const [viewOpen, setViewOpen] = React.useState(false)
    const [viewBusy, setViewBusy] = React.useState(false)
    const [viewReferral, setViewReferral] = React.useState<UiReferral | null>(null)

    // ✅ Delete
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [deleteBusy, setDeleteBusy] = React.useState(false)
    const [deleteTarget, setDeleteTarget] = React.useState<UiReferral | null>(null)

    const load = async (mode: "initial" | "refresh" = "refresh") => {
        const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing
        setBusy(true)

        try {
            const list = await fetchReferralUserReferrals({ per_page: 100 }, token)
            const mapped = (Array.isArray(list) ? list : []).map(toUiReferral)
            setRows(mapped)
        } catch (err: any) {
            const status = err?.status
            const msg =
                status === 401
                    ? "Unauthenticated (401). Please login again."
                    : status === 403
                        ? "Forbidden (403). Your role is not allowed to access referrals."
                        : err instanceof Error
                            ? err.message
                            : "Failed to load referrals."
            toast.error(msg)
        } finally {
            setBusy(false)
        }
    }

    React.useEffect(() => {
        void load("initial")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const refresh = async () => {
        if (isLoading || isRefreshing) return
        await load("refresh")
    }

    // student search debounce (works for create/edit)
    React.useEffect(() => {
        if (!upsertOpen) return
        if (studentMode !== "search") return

        const q = studentQuery.trim()
        const shouldFetch = q.length === 0 || q.length >= 2

        if (!shouldFetch) {
            setStudentResults([])
            setStudentLoading(false)
            return
        }

        let cancelled = false

        const t = window.setTimeout(async () => {
            setStudentLoading(true)
            try {
                const res = await trySearchStudents(q, token)
                if (cancelled) return
                setStudentResults(res)
                setStudentSearchBlocked(false)
            } catch (e: any) {
                if (cancelled) return
                setStudentResults([])

                const status = e?.status
                if (status === 403) {
                    setStudentSearchBlocked(true)
                    if (!studentSearchWarnedRef.current) {
                        toast.error("Student search is not permitted for your role. Use Manual student ID.")
                        studentSearchWarnedRef.current = true
                    }
                    return
                }

                toast.error(e instanceof Error ? e.message : "Failed to search students.")
            } finally {
                if (!cancelled) setStudentLoading(false)
            }
        }, q.length === 0 ? 0 : 300)

        return () => {
            cancelled = true
            window.clearTimeout(t)
        }
    }, [studentQuery, token, upsertOpen, studentMode])

    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        return rows
            .filter((r) => (statusFilter === "all" ? true : safeLower(r.status) === statusFilter))
            .filter((r) => {
                if (!q) return true
                return (
                    String(r.id).toLowerCase().includes(q) ||
                    String(r.studentId).toLowerCase().includes(q) ||
                    r.studentName.toLowerCase().includes(q) ||
                    String(r.studentEmail ?? "").toLowerCase().includes(q) ||
                    r.concernType.toLowerCase().includes(q) ||
                    String(r.urgency).toLowerCase().includes(q) ||
                    String(r.status).toLowerCase().includes(q) ||
                    r.requestedByName.toLowerCase().includes(q) ||
                    // ✅ appointment searchable
                    String(r.scheduledDate ?? "").toLowerCase().includes(q) ||
                    String(r.scheduledTime ?? "").toLowerCase().includes(q)
                )
            })
    }, [rows, statusFilter, search])

    const counts = React.useMemo(() => {
        const all = rows.length
        const pending = rows.filter((r) => safeLower(r.status) === "pending").length
        const handled = rows.filter((r) => safeLower(r.status) === "handled").length
        const closed = rows.filter((r) => safeLower(r.status) === "closed").length
        return { all, pending, handled, closed }
    }, [rows])

    const canModify = (r: UiReferral) => safeLower(r.status) === "pending"

    const resetForm = () => {
        setStudentMode("search")
        setStudentQuery("")
        setStudentResults([])
        setSelectedStudent(null)
        setManualStudentId("")
        setConcernType("")
        setUrgency("medium")
        setDetails("")
        setStudentSearchBlocked(false)
        studentSearchWarnedRef.current = false
    }

    const openCreate = () => {
        setUpsertMode("create")
        setEditingId(null)
        resetForm()
        setUpsertOpen(true)
    }

    const openEdit = (r: UiReferral) => {
        if (!canModify(r)) {
            toast.error("You can only edit a referral while it is still Pending.")
            return
        }

        setUpsertMode("edit")
        setEditingId(r.id)

        // Prefill (manual by default)
        setStudentMode("manual")
        setStudentQuery("")
        setStudentResults([])
        setSelectedStudent(null)
        setManualStudentId(String(r.studentId ?? "").trim())

        setConcernType(String(r.concernType ?? ""))
        setUrgency((safeLower(r.urgency) as Urgency) || "medium")
        setDetails(String(r.details ?? ""))

        setStudentSearchBlocked(false)
        studentSearchWarnedRef.current = false

        setUpsertOpen(true)
    }

    const closeUpsert = () => {
        if (upsertBusy) return
        setUpsertOpen(false)
    }

    const openDelete = (r: UiReferral) => {
        if (!canModify(r)) {
            toast.error("You can only delete a referral while it is still Pending.")
            return
        }
        setDeleteTarget(r)
        setDeleteOpen(true)
    }

    const closeDelete = () => {
        if (deleteBusy) return
        setDeleteOpen(false)
    }

    const openView = async (r: UiReferral) => {
        setViewReferral(r)
        setViewOpen(true)

        // Fetch latest details (READ) using existing show endpoint
        setViewBusy(true)
        try {
            const res = await apiFetch(
                `/referral-user/referrals/${encodeURIComponent(String(r.id))}`,
                { method: "GET" },
                token,
            )
            const dto = (res as any)?.referral as ReferralDto | undefined
            if (dto) setViewReferral(toUiReferral(dto))
        } catch (err: any) {
            // If show endpoint is not available for some reason, keep local data.
            const status = err?.status
            if (status && status !== 404) {
                toast.error(err instanceof Error ? err.message : "Failed to load referral details.")
            }
        } finally {
            setViewBusy(false)
        }
    }

    const closeView = () => {
        if (viewBusy) return
        setViewOpen(false)
    }

    const getStudentIdentifier = () => {
        const searchIdentifier = selectedStudent
            ? (safeText(selectedStudent.studentId) || safeText(selectedStudent.id))
            : ""

        const studentIdentifier =
            studentMode === "manual"
                ? manualStudentId.trim()
                : searchIdentifier.trim()

        return studentIdentifier
    }

    const submitUpsert = async () => {
        const studentIdentifier = getStudentIdentifier()

        if (!studentIdentifier) {
            toast.error("Student ID is required.")
            return
        }

        const concern = concernType.trim()
        if (!concern) {
            toast.error("Concern Type is required.")
            return
        }

        const desc = details.trim()
        if (!desc) {
            toast.error("Details are required.")
            return
        }

        setUpsertBusy(true)

        try {
            if (upsertMode === "create") {
                const payload = {
                    student_id: String(studentIdentifier),
                    concern_type: concern,
                    urgency,
                    details: desc,
                }

                const res = await createReferralApi(payload as any, token)
                const dto = (res as any)?.referral as ReferralDto | undefined

                if (dto) {
                    const ui = toUiReferral(dto)
                    setRows((prev) => [ui, ...prev])
                } else {
                    await refresh()
                }

                toast.success("Referral submitted successfully.")
                closeUpsert()
                return
            }

            // ✅ UPDATE (Edit)
            if (!editingId) {
                toast.error("Missing referral id for update.")
                return
            }

            const payload = {
                student_id: String(studentIdentifier),
                concern_type: concern,
                urgency,
                details: desc,
            }

            // NOTE:
            // This expects backend support:
            // PATCH /referral-user/referrals/{id}
            const res = await apiFetch(
                `/referral-user/referrals/${encodeURIComponent(String(editingId))}`,
                { method: "PATCH", body: JSON.stringify(payload) },
                token,
            )

            const dto = (res as any)?.referral as ReferralDto | undefined
            if (dto) {
                const ui = toUiReferral(dto)
                setRows((prev) => prev.map((x) => (String(x.id) === String(ui.id) ? ui : x)))
            } else {
                await refresh()
            }

            toast.success("Referral updated successfully.")
            closeUpsert()
        } catch (err: any) {
            const status = err?.status
            const msg =
                status === 404
                    ? "Update endpoint not found (404). Please add PATCH /referral-user/referrals/{id} in Laravel."
                    : status === 403
                        ? "Forbidden (403). You are not allowed to update this referral."
                        : status === 422
                            ? "Validation failed (422). Please check inputs."
                            : err instanceof Error
                                ? err.message
                                : "Failed to save referral."
            toast.error(msg)
        } finally {
            setUpsertBusy(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return

        setDeleteBusy(true)
        try {
            // ✅ DELETE
            // This expects backend support:
            // DELETE /referral-user/referrals/{id}
            await apiFetch(
                `/referral-user/referrals/${encodeURIComponent(String(deleteTarget.id))}`,
                { method: "DELETE" },
                token,
            )

            setRows((prev) => prev.filter((x) => String(x.id) !== String(deleteTarget.id)))
            toast.success("Referral deleted.")
            setDeleteOpen(false)
        } catch (err: any) {
            const status = err?.status
            const msg =
                status === 404
                    ? "Delete endpoint not found (404). Please add DELETE /referral-user/referrals/{id} in Laravel."
                    : status === 403
                        ? "Forbidden (403). You are not allowed to delete this referral."
                        : err instanceof Error
                            ? err.message
                            : "Failed to delete referral."
            toast.error(msg)
        } finally {
            setDeleteBusy(false)
        }
    }

    return (
        <DashboardLayout
            title="Referrals"
            description="Create, view, edit, and delete your submitted referrals."
        >
            <div className="mx-auto w-full max-w-7xl space-y-4">
                <Card className="border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="text-base sm:text-lg">Referral Module</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    Submit student referrals to the Guidance & Counseling Office.
                                </CardDescription>
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 w-full sm:w-auto"
                                    onClick={refresh}
                                    disabled={isLoading || isRefreshing}
                                >
                                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                                    Refresh
                                </Button>

                                <Button type="button" className="h-10 w-full sm:w-auto" onClick={openCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create referral
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="h-6 px-2 text-[0.70rem]">
                                    All: {counts.all}
                                </Badge>
                                <Badge variant="secondary" className="h-6 px-2 text-[0.70rem]">
                                    Pending: {counts.pending}
                                </Badge>
                                <Badge variant="default" className="h-6 px-2 text-[0.70rem]">
                                    Handled: {counts.handled}
                                </Badge>
                                <Badge variant="outline" className="h-6 px-2 text-[0.70rem]">
                                    Closed: {counts.closed}
                                </Badge>
                            </div>

                            <div className="sm:col-span-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search by student, status, concern, appointment…"
                                        className="h-10 pl-9"
                                    />
                                </div>
                            </div>

                            <div className="flex">
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                    <SelectTrigger className="h-10 w-full">
                                        <SelectValue placeholder="Filter status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="handled">Handled</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-white/60 p-3 text-[0.75rem] text-muted-foreground">
                            <span className="font-medium text-slate-700">Requested by:</span> {myName} •{" "}
                            <span className="font-medium text-slate-700">Role:</span> {myRole}
                        </div>
                    </CardHeader>

                    <Separator />

                    <CardContent className="p-0">
                        <ScrollArea className="h-144">
                            <div className="p-3 sm:p-4">
                                {isLoading ? (
                                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                                        Loading referrals…
                                    </div>
                                ) : filteredRows.length === 0 ? (
                                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                                        No referrals found.
                                    </div>
                                ) : (
                                    <div className="rounded-xl border bg-white/60">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-32">Status</TableHead>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead>Concern</TableHead>
                                                    <TableHead className="w-32">Urgency</TableHead>

                                                    {/* ✅ Appointment (read) */}
                                                    <TableHead className="hidden lg:table-cell w-52">Appointment</TableHead>

                                                    <TableHead className="hidden lg:table-cell">Requested By</TableHead>
                                                    <TableHead className="hidden md:table-cell w-48">Created</TableHead>
                                                    <TableHead className="w-16 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredRows.map((r) => {
                                                    const apptText = appointmentLabel(r.scheduledDate ?? null, r.scheduledTime ?? null)
                                                    const hasAppt = apptText !== "—"

                                                    return (
                                                        <TableRow
                                                            key={String(r.id)}
                                                            className="cursor-pointer hover:bg-white"
                                                            onClick={() => void openView(r)}
                                                        >
                                                            <TableCell>
                                                                <Badge variant={statusBadgeVariant(r.status)} className="capitalize">
                                                                    {String(r.status)}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell>
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-slate-900">
                                                                        {r.studentName}
                                                                    </div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        Student ID: {r.studentId}
                                                                        {r.studentEmail ? ` • ${r.studentEmail}` : ""}
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-medium text-slate-900">
                                                                        {r.concernType}
                                                                    </div>
                                                                    <div className="line-clamp-2 text-xs text-muted-foreground">
                                                                        {r.details || "—"}
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>
                                                                <Badge variant={urgencyBadgeVariant(String(r.urgency))} className="capitalize">
                                                                    {String(r.urgency)}
                                                                </Badge>
                                                            </TableCell>

                                                            {/* ✅ Appointment (read) */}
                                                            <TableCell className="hidden lg:table-cell">
                                                                <div className="flex items-start gap-2">
                                                                    <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm">{apptText}</div>
                                                                        <div className="truncate text-xs text-muted-foreground">
                                                                            {hasAppt ? "Set by counselor" : "Not set"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden lg:table-cell">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-medium text-slate-900">
                                                                        {r.requestedByName}
                                                                    </div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        {r.requestedByRole}
                                                                    </div>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                                                {safeDateShort(r.createdAt)}
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                <div onClick={(e) => e.stopPropagation()}>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>

                                                                        <DropdownMenuContent align="end" className="w-44">
                                                                            <DropdownMenuLabel>Referral</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />

                                                                            <DropdownMenuItem onSelect={() => void openView(r)}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View
                                                                            </DropdownMenuItem>

                                                                            <DropdownMenuItem
                                                                                disabled={!canModify(r)}
                                                                                onSelect={() => openEdit(r)}
                                                                            >
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </DropdownMenuItem>

                                                                            <DropdownMenuItem
                                                                                disabled={!canModify(r)}
                                                                                onSelect={() => openDelete(r)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* ✅ View (Read) */}
                <Dialog open={viewOpen} onOpenChange={(v) => (!viewBusy ? setViewOpen(v) : null)}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Referral details</DialogTitle>
                            <DialogDescription>
                                {viewReferral ? `Referral #${viewReferral.id}` : "Referral"}
                            </DialogDescription>
                        </DialogHeader>

                        {!viewReferral ? (
                            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                                No referral selected.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={statusBadgeVariant(viewReferral.status)} className="capitalize">
                                            {String(viewReferral.status)}
                                        </Badge>
                                        <Badge variant={urgencyBadgeVariant(String(viewReferral.urgency))} className="capitalize">
                                            {String(viewReferral.urgency)}
                                        </Badge>
                                        {viewBusy ? (
                                            <Badge variant="secondary" className="gap-2">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Updating…
                                            </Badge>
                                        ) : null}
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        Created: {safeDateTime(viewReferral.createdAt || null) || "—"}
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-white/60 p-3">
                                        <div className="text-xs text-muted-foreground">Student</div>
                                        <div className="truncate text-sm font-semibold text-slate-900">{viewReferral.studentName}</div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            Student ID: {viewReferral.studentId || "—"}
                                            {viewReferral.studentEmail ? ` • ${viewReferral.studentEmail}` : ""}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border bg-white/60 p-3">
                                        <div className="text-xs text-muted-foreground">Assigned counselor</div>
                                        <div className="truncate text-sm font-semibold text-slate-900">
                                            {viewReferral.counselorName || "—"}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            {viewReferral.counselorEmail || "Not assigned"}
                                        </div>
                                    </div>
                                </div>

                                {/* ✅ Appointment (read) */}
                                <div className="rounded-xl border bg-white/60 p-3">
                                    <div className="flex items-center gap-2">
                                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-xs text-muted-foreground">Appointment</div>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                        {appointmentLabel(viewReferral.scheduledDate ?? null, viewReferral.scheduledTime ?? null)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {appointmentLabel(viewReferral.scheduledDate ?? null, viewReferral.scheduledTime ?? null) === "—"
                                            ? "Not set yet."
                                            : "Set by counselor (read-only)."}
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-white/60 p-3">
                                    <div className="text-xs text-muted-foreground">Concern type</div>
                                    <div className="text-sm font-semibold text-slate-900">{viewReferral.concernType || "—"}</div>
                                </div>

                                <div className="rounded-xl border bg-white/60 p-3">
                                    <div className="text-xs text-muted-foreground">Details</div>
                                    <div className="whitespace-pre-wrap text-sm text-slate-900">{viewReferral.details || "—"}</div>
                                </div>

                                <div className="rounded-xl border bg-white/60 p-3">
                                    <div className="text-xs text-muted-foreground">Remarks</div>
                                    <div className="whitespace-pre-wrap text-sm text-slate-900">{viewReferral.remarks || "—"}</div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-white/60 p-3">
                                        <div className="text-xs text-muted-foreground">Handled at</div>
                                        <div className="text-sm text-slate-900">{safeDateTime(viewReferral.handledAt || null) || "—"}</div>
                                    </div>
                                    <div className="rounded-xl border bg-white/60 p-3">
                                        <div className="text-xs text-muted-foreground">Closed at</div>
                                        <div className="text-sm text-slate-900">{safeDateTime(viewReferral.closedAt || null) || "—"}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeView} disabled={viewBusy}>
                                Close
                            </Button>
                            {viewReferral && canModify(viewReferral) ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        closeView()
                                        openEdit(viewReferral)
                                    }}
                                    disabled={viewBusy}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                            ) : null}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ✅ Create / Edit (CRUD) */}
                <Dialog open={upsertOpen} onOpenChange={(v) => (!upsertBusy ? setUpsertOpen(v) : null)}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{upsertMode === "create" ? "Create referral" : "Edit referral"}</DialogTitle>
                            <DialogDescription>
                                {upsertMode === "create"
                                    ? "Select a student and submit a referral request."
                                    : "Update the details of your pending referral."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <Tabs value={studentMode} onValueChange={(v) => setStudentMode(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="search">Search student</TabsTrigger>
                                    <TabsTrigger value="manual">Manual student ID</TabsTrigger>
                                </TabsList>

                                <TabsContent value="search" className="space-y-2 pt-3">
                                    <Label className="text-xs">Student (required)</Label>
                                    <StudentCombobox
                                        students={studentResults}
                                        value={selectedStudent}
                                        onChange={(u) => setSelectedStudent(u)}
                                        searchValue={studentQuery}
                                        onSearchValueChange={(v) => {
                                            setStudentQuery(v)
                                            setSelectedStudent(null)
                                        }}
                                        isLoading={studentLoading}
                                        disabled={upsertBusy}
                                    />

                                    <div className="text-[0.70rem] text-muted-foreground">
                                        {studentSearchBlocked ? (
                                            <>
                                                Student search is blocked for your role (403). Please switch to{" "}
                                                <span className="font-semibold">Manual student ID</span>.
                                            </>
                                        ) : (
                                            <>
                                                If you can’t search students (403), switch to{" "}
                                                <span className="font-semibold">Manual student ID</span>.
                                            </>
                                        )}
                                    </div>

                                    {selectedStudent?.email ? (
                                        <div className="text-[0.70rem] text-muted-foreground">
                                            Selected email:{" "}
                                            <span className="font-semibold text-slate-700">{selectedStudent.email}</span>
                                        </div>
                                    ) : null}
                                </TabsContent>

                                <TabsContent value="manual" className="space-y-2 pt-3">
                                    <Label className="text-xs">Student ID (required)</Label>
                                    <Input
                                        value={manualStudentId}
                                        onChange={(e) => setManualStudentId(e.target.value)}
                                        placeholder="Enter the student ID (users.student_id)…"
                                        className="h-10"
                                        disabled={upsertBusy}
                                    />
                                    <div className="text-[0.70rem] text-muted-foreground">
                                        Enter the student’s <span className="font-semibold">Student ID</span> from{" "}
                                        <span className="font-semibold">users.student_id</span> (not the internal user ID).
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Concern type (required)</Label>
                                    <Input
                                        value={concernType}
                                        onChange={(e) => setConcernType(e.target.value)}
                                        placeholder="e.g., Academic, Behavior, Mental Health…"
                                        className="h-10"
                                        disabled={upsertBusy}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Urgency (required)</Label>
                                    <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)} disabled={upsertBusy}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select urgency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Details (required)</Label>
                                <Textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    placeholder="Write complete referral details…"
                                    className="min-h-28"
                                    disabled={upsertBusy}
                                />
                            </div>

                            <div className="rounded-xl border bg-muted/30 p-3 text-[0.75rem] text-muted-foreground">
                                <div>
                                    <span className="font-semibold text-slate-700">Requested By:</span> {myName}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Role:</span> {myRole}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeUpsert} disabled={upsertBusy}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={submitUpsert} disabled={upsertBusy}>
                                {upsertBusy ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        {upsertMode === "create" ? (
                                            <>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Submit referral
                                            </>
                                        ) : (
                                            <>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Save changes
                                            </>
                                        )}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ✅ Delete confirmation */}
                <AlertDialog open={deleteOpen} onOpenChange={(v) => (!deleteBusy ? setDeleteOpen(v) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete referral?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. Only pending referrals should be deleted.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                            <div className="font-semibold text-slate-900">
                                {deleteTarget ? `Referral #${deleteTarget.id}` : "Referral"}
                            </div>
                            <div className="truncate">
                                {deleteTarget?.studentName ? `${deleteTarget.studentName} • Student ID: ${deleteTarget.studentId}` : "—"}
                            </div>
                            <div className="truncate">{deleteTarget?.concernType || "—"}</div>
                        </div>

                        <AlertDialogFooterUi>
                            <AlertDialogCancel onClick={closeDelete} disabled={deleteBusy}>
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} disabled={deleteBusy}>
                                {deleteBusy ? (
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
                        </AlertDialogFooterUi>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}

export default ReferralUserReferrals
