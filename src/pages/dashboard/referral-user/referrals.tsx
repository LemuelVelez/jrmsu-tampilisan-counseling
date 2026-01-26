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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { Check, ChevronsUpDown, Plus, RefreshCw, Search } from "lucide-react"

type ReferralStatus = "pending" | "handled" | "closed" | string
type Urgency = "low" | "medium" | "high"

type DirectoryStudent = {
    id: number | string
    name: string
    email?: string | null
    role?: string | null
}

type UiReferral = {
    id: number | string

    studentId: number | string
    studentName: string
    studentEmail?: string | null

    concernType: string
    urgency: Urgency | string
    details: string

    status: ReferralStatus

    requestedByName: string
    requestedByRole: string

    createdAt?: string
    updatedAt?: string
}

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined

const INSTITUTION_EMAIL_DOMAIN =
    (import.meta.env.VITE_INSTITUTION_EMAIL_DOMAIN as string | undefined)?.trim()?.replace(/^@/, "") ||
    "jrmsu.edu.ph"

function resolveApiUrl(path: string): string {
    if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.")
    const trimmed = path.replace(/^\/+/, "")
    return `${API_BASE_URL}/${trimmed}`
}

function isOfficialDomainEmail(email?: string | null): boolean {
    const e = String(email ?? "").trim().toLowerCase()
    if (!e) return false
    const d = String(INSTITUTION_EMAIL_DOMAIN || "").trim().toLowerCase().replace(/^@/, "")
    if (!d) return true
    return e.endsWith(`@${d}`)
}

function safeText(v: any, fallback = ""): string {
    const s = typeof v === "string" ? v.trim() : ""
    return s || fallback
}

/** ✅ FIX: removed unused safeDate() */

function safeDateShort(iso?: string) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "MMM d, yyyy")
}

function toUiReferral(dto: ReferralDto): UiReferral {
    const anyDto = dto as any

    const studentId = (anyDto?.student_id ?? anyDto?.studentId ?? "") as any

    const studentName =
        safeText(anyDto?.student_name) ||
        safeText(anyDto?.student?.name) ||
        (studentId ? `Student #${studentId}` : "Student")

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
        "You"

    const requestedByRole =
        safeText(anyDto?.requested_by_role) ||
        safeText(anyDto?.requestedBy?.role) ||
        "Referral User"

    return {
        id: dto.id,

        studentId,
        studentName,
        studentEmail,

        concernType,
        urgency,
        details,

        status,

        requestedByName,
        requestedByRole,

        createdAt: safeText(anyDto?.created_at) || undefined,
        updatedAt: safeText(anyDto?.updated_at) || undefined,
    }
}

function statusBadgeVariant(status: string): "secondary" | "default" | "destructive" | "outline" {
    const s = String(status || "").toLowerCase()
    if (s === "pending") return "secondary"
    if (s === "handled") return "default"
    if (s === "closed") return "outline"
    return "secondary"
}

function urgencyBadgeVariant(urgency: string): "secondary" | "default" | "destructive" | "outline" {
    const u = String(urgency || "").toLowerCase()
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
        throw new Error(msg)
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
 * ✅ Add Users (Student Search)
 * We try multiple possible backend endpoints.
 * If forbidden (403) or missing, UI still supports manual Student ID entry.
 */
async function trySearchStudents(query: string, token?: string | null): Promise<DirectoryStudent[]> {
    const q = query.trim()
    const qq = encodeURIComponent(q)

    const candidates = [
        // most ideal (if you add later)
        `/referral-user/students?search=${qq}`,
        `/referral-user/users?role=student&search=${qq}`,

        // generic directory style
        `/users?role=student&search=${qq}`,
        `/users/search?role=student&q=${qq}`,
        `/search/users?role=student&q=${qq}`,

        // legacy names
        `/students?search=${qq}`,
        `/students?q=${qq}`,
        `/students/search?q=${qq}`,
    ]

    let lastErr: any = null

    for (const p of candidates) {
        try {
            const data = await apiFetch(p, { method: "GET" }, token)
            const arr = extractUsersArray(data)

            const mapped: DirectoryStudent[] = arr
                .map((raw: any) => raw?.user ?? raw)
                .map((u: any) => {
                    const id = u?.id ?? u?.user_id ?? u?.student_id
                    if (id == null || String(id).trim() === "") return null

                    const name =
                        safeText(u?.name) ||
                        safeText(u?.full_name) ||
                        safeText(u?.fullname) ||
                        "Unknown"

                    const email = safeText(u?.email) || null
                    const role = safeText(u?.role) || null

                    return {
                        id,
                        name,
                        email,
                        role,
                    } as DirectoryStudent
                })
                .filter(Boolean) as DirectoryStudent[]

            // keep only "student-like" if role is present
            const filtered = mapped.filter((u) => {
                if (!u.role) return true
                return String(u.role).toLowerCase().includes("student")
            })

            // de-dupe
            const seen = new Set<string>()
            return filtered.filter((u) => {
                const k = String(u.id)
                if (seen.has(k)) return false
                seen.add(k)
                return true
            })
        } catch (e) {
            lastErr = e
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
}) {
    const { students, value, onChange, searchValue, onSearchValueChange, isLoading } = props
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between">
                    <span className={cn("min-w-0 truncate text-left", !value ? "text-muted-foreground" : "")}>
                        {value ? `${value.name} • ID: ${value.id}` : "Search student…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Type name / email / ID…"
                        value={searchValue}
                        onValueChange={(v) => onSearchValueChange(v)}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {isLoading ? "Searching…" : searchValue.trim().length < 2 ? "Type at least 2 characters." : "No students found."}
                        </CommandEmpty>

                        <CommandGroup>
                            {students.map((u) => {
                                const selected = !!value && String(value.id) === String(u.id)
                                const emailOk = !u.email ? true : isOfficialDomainEmail(u.email)

                                return (
                                    <CommandItem
                                        key={String(u.id)}
                                        value={`${u.name} ${u.email ?? ""} ${u.id}`}
                                        onSelect={() => {
                                            if (!emailOk) {
                                                toast.error(`Student email must use official domain @${INSTITUTION_EMAIL_DOMAIN}`)
                                                return
                                            }
                                            onChange(u)
                                            setOpen(false)
                                        }}
                                        className="gap-2"
                                    >
                                        <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="truncate text-sm">{u.name}</div>
                                                {!emailOk ? (
                                                    <Badge variant="destructive" className="h-5 px-2 text-[0.65rem]">
                                                        Domain restricted
                                                    </Badge>
                                                ) : null}
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                ID: {u.id}
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

    // create dialog
    const [createOpen, setCreateOpen] = React.useState(false)
    const [createBusy, setCreateBusy] = React.useState(false)

    // student selection
    const [studentMode, setStudentMode] = React.useState<"search" | "manual">("search")
    const [studentQuery, setStudentQuery] = React.useState("")
    const [studentLoading, setStudentLoading] = React.useState(false)
    const [studentResults, setStudentResults] = React.useState<DirectoryStudent[]>([])
    const [selectedStudent, setSelectedStudent] = React.useState<DirectoryStudent | null>(null)
    const [manualStudentId, setManualStudentId] = React.useState("")

    // form
    const [concernType, setConcernType] = React.useState("")
    const [urgency, setUrgency] = React.useState<Urgency>("medium")
    const [details, setDetails] = React.useState("")

    const load = async (mode: "initial" | "refresh" = "refresh") => {
        const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing
        setBusy(true)

        try {
            const list = await fetchReferralUserReferrals()
            const mapped = (Array.isArray(list) ? list : []).map(toUiReferral)
            setRows(mapped)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load referrals.")
        } finally {
            setBusy(false)
        }
    }

    React.useEffect(() => {
        load("initial")

    }, [])

    const refresh = async () => {
        if (isLoading || isRefreshing) return
        await load("refresh")
    }

    // student search debounce
    React.useEffect(() => {
        if (!createOpen) return
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
            } catch (e) {
                if (cancelled) return
                setStudentResults([])
                // we allow manual fallback even if forbidden
                toast.error(e instanceof Error ? e.message : "Failed to search students.")
            } finally {
                if (!cancelled) setStudentLoading(false)
            }
        }, q.length === 0 ? 0 : 300)

        return () => {
            cancelled = true
            window.clearTimeout(t)
        }
    }, [studentQuery, token, createOpen, studentMode])

    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        return rows
            .filter((r) => (statusFilter === "all" ? true : String(r.status).toLowerCase() === statusFilter))
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
                    r.requestedByName.toLowerCase().includes(q)
                )
            })
    }, [rows, statusFilter, search])

    const counts = React.useMemo(() => {
        const all = rows.length
        const pending = rows.filter((r) => String(r.status).toLowerCase() === "pending").length
        const handled = rows.filter((r) => String(r.status).toLowerCase() === "handled").length
        const closed = rows.filter((r) => String(r.status).toLowerCase() === "closed").length
        return { all, pending, handled, closed }
    }, [rows])

    const resetCreateForm = () => {
        setStudentMode("search")
        setStudentQuery("")
        setStudentResults([])
        setSelectedStudent(null)
        setManualStudentId("")
        setConcernType("")
        setUrgency("medium")
        setDetails("")
    }

    const openCreate = () => {
        resetCreateForm()
        setCreateOpen(true)
    }

    const closeCreate = () => {
        if (createBusy) return
        setCreateOpen(false)
    }

    const submitCreateReferral = async () => {
        const studentId =
            studentMode === "manual" ? manualStudentId.trim() : selectedStudent?.id != null ? String(selectedStudent.id) : ""

        if (!studentId) {
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

        // ✅ Domain restriction (only if we actually have the student's email)
        if (studentMode === "search" && selectedStudent?.email && !isOfficialDomainEmail(selectedStudent.email)) {
            toast.error(`Student email must use official domain @${INSTITUTION_EMAIL_DOMAIN}`)
            return
        }

        setCreateBusy(true)

        try {
            // ✅ Backend expects:
            // student_id, concern_type, urgency, details
            const payload = {
                student_id: Number.isFinite(Number(studentId)) ? Number(studentId) : studentId,
                concern_type: concern,
                urgency,
                details: desc,
            }

            // createReferralApi typing in your frontend may be older -> safe cast
            const res = await createReferralApi(payload as any)
            const dto = (res as any)?.referral as ReferralDto | undefined

            if (!dto) {
                toast.success("Referral submitted.")
                closeCreate()
                await refresh()
                return
            }

            const ui = toUiReferral(dto)
            setRows((prev) => [ui, ...prev])
            toast.success("Referral submitted successfully.")
            closeCreate()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to submit referral.")
        } finally {
            setCreateBusy(false)
        }
    }

    return (
        <DashboardLayout
            title="Referrals"
            description="Create referrals for students and track your submitted requests."
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
                            <div className="flex items-center gap-2">
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
                                        placeholder="Search by student, status, concern, requested by…"
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
                            <span className="font-medium text-slate-700">Role:</span> {myRole} •{" "}
                            <span className="font-medium text-slate-700">Domain restriction:</span> Only official emails{" "}
                            <span className="font-semibold text-slate-700">@{INSTITUTION_EMAIL_DOMAIN}</span>
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
                                                    <TableHead className="hidden lg:table-cell">Requested By</TableHead>
                                                    <TableHead className="hidden md:table-cell w-48">Created</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredRows.map((r) => (
                                                    <TableRow
                                                        key={String(r.id)}
                                                        className="cursor-pointer hover:bg-white"
                                                        onClick={() => {
                                                            // optional details route (if you add later)
                                                            // navigate(`/dashboard/referral-user/referrals/${r.id}`)
                                                            toast.message(`Referral #${r.id}`)
                                                        }}
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
                                                                    ID: {r.studentId}
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
                                                            <Badge variant={urgencyBadgeVariant(r.urgency)} className="capitalize">
                                                                {String(r.urgency)}
                                                            </Badge>
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
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Create referral dialog */}
                <Dialog open={createOpen} onOpenChange={(v) => (!createBusy ? setCreateOpen(v) : null)}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Create referral</DialogTitle>
                            <DialogDescription>
                                Select a student and submit a referral request to the counselor.
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
                                    />

                                    <div className="text-[0.70rem] text-muted-foreground">
                                        If you can’t search students (403), switch to <span className="font-semibold">Manual student ID</span>.
                                    </div>

                                    {selectedStudent?.email ? (
                                        <div className="text-[0.70rem] text-muted-foreground">
                                            Selected email:{" "}
                                            <span className={cn("font-semibold", isOfficialDomainEmail(selectedStudent.email) ? "text-slate-700" : "text-destructive")}>
                                                {selectedStudent.email}
                                            </span>
                                        </div>
                                    ) : null}
                                </TabsContent>

                                <TabsContent value="manual" className="space-y-2 pt-3">
                                    <Label className="text-xs">Student ID (required)</Label>
                                    <Input
                                        value={manualStudentId}
                                        onChange={(e) => setManualStudentId(e.target.value)}
                                        placeholder="Enter student user ID…"
                                        className="h-10"
                                    />
                                    <div className="text-[0.70rem] text-muted-foreground">
                                        Make sure this is the correct student <span className="font-semibold">User ID</span> in your system.
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
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Urgency (required)</Label>
                                    <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
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
                                />
                            </div>

                            <div className="rounded-xl border bg-muted/30 p-3 text-[0.75rem] text-muted-foreground">
                                <div>
                                    <span className="font-semibold text-slate-700">Requested By:</span> {myName}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Role:</span> {myRole}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Domain restriction:</span> Official email{" "}
                                    <span className="font-semibold text-slate-700">@{INSTITUTION_EMAIL_DOMAIN}</span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeCreate} disabled={createBusy}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={submitCreateReferral} disabled={createBusy}>
                                {createBusy ? "Submitting…" : "Submit referral"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}

export default ReferralUserReferrals
