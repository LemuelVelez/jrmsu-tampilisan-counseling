/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
    Eye,
    RefreshCw,
    Search,
    MoreHorizontal,
    CircleDashed,
    CheckCircle2,
    XCircle,
    ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/DashboardLayout"

import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

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

    created_at?: string | null
    updated_at?: string | null

    student?: UserMini | null
    requestedBy?: UserMini | null
    counselor?: UserMini | null

    // fallback flat fields (if backend returns flat dto)
    student_name?: string | null
    student_email?: string | null
    requested_by_name?: string | null
    requested_by_role?: string | null
    requested_by_email?: string | null
}

function trimSlash(s: string) {
    return s.replace(/\/+$/, "")
}

function safeStr(v: unknown) {
    return typeof v === "string" ? v : v == null ? "" : String(v)
}

function toDateTimeLabel(value?: string | null) {
    if (!value) return "—"
    const d = new Date(value)
    const t = d.getTime()
    if (Number.isNaN(t)) return value
    return d.toLocaleString()
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

    return {
        id: raw?.id ?? "",
        status: raw?.status ?? "pending",
        concern_type: raw?.concern_type ?? raw?.concern ?? null,
        urgency: raw?.urgency ?? null,
        details: raw?.details ?? null,

        created_at: raw?.created_at ?? null,
        updated_at: raw?.updated_at ?? null,

        student,
        requestedBy,
        counselor,

        // flat fallback
        student_name: raw?.student_name ?? null,
        student_email: raw?.student_email ?? null,
        requested_by_name: raw?.requested_by_name ?? null,
        requested_by_role: raw?.requested_by_role ?? null,
        requested_by_email: raw?.requested_by_email ?? null,
    }
}

function getOfficialDomain(): string {
    const envDomain =
        (import.meta as any)?.env?.VITE_INSTITUTION_EMAIL_DOMAIN ||
        (import.meta as any)?.env?.VITE_OFFICIAL_EMAIL_DOMAIN ||
        "jrmsu.edu.ph"
    return String(envDomain).trim().replace(/^@/, "")
}

function isOfficialEmail(email?: string | null): boolean {
    if (!email) return true
    const domain = getOfficialDomain().toLowerCase()
    return email.toLowerCase().endsWith("@" + domain)
}

function statusBadge(status: ReferralStatus) {
    const s = String(status || "").toLowerCase()

    if (s === "pending") {
        return (
            <Badge variant="secondary" className="gap-1">
                <CircleDashed className="h-3.5 w-3.5" />
                Pending
            </Badge>
        )
    }

    if (s === "handled") {
        return (
            <Badge className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Handled
            </Badge>
        )
    }

    if (s === "closed") {
        return (
            <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                Closed
            </Badge>
        )
    }

    return <Badge variant="outline">{safeStr(status) || "Unknown"}</Badge>
}

async function counselorFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.")
    }

    const url = `${trimSlash(AUTH_API_BASE_URL)}/${path.replace(/^\/+/, "")}`

    const res = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(init.headers),
        credentials: "include",
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
        const message = data?.message || data?.error || res.statusText || "Request failed."
        throw new Error(message)
    }

    return data as T
}

async function fetchCounselorReferrals(status?: string) {
    const qs = new URLSearchParams()
    qs.set("per_page", "100")
    if (status && status !== "all") qs.set("status", status)

    // ✅ backend: GET /counselor/referrals
    const json = await counselorFetch<any>(`/counselor/referrals?${qs.toString()}`, {
        method: "GET",
    })

    const items = Array.isArray(json?.referrals) ? json.referrals : Array.isArray(json?.data) ? json.data : []
    return items.map(normalizeReferral) as ReferralView[]
}

async function patchReferral(
    id: number | string,
    payload: { status?: string; remarks?: string | null; counselor_id?: number | string | null },
) {
    // ✅ backend: PATCH /counselor/referrals/{id}
    const json = await counselorFetch<any>(`/counselor/referrals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    })

    const ref = json?.referral ?? json
    return normalizeReferral(ref)
}

export default function CounselorReferralsPage() {
    const navigate = useNavigate()

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [tab, setTab] = React.useState<"all" | "pending" | "handled" | "closed">("all")
    const [query, setQuery] = React.useState("")

    const [rows, setRows] = React.useState<ReferralView[]>([])

    const [page, setPage] = React.useState(1)
    const pageSize = 10

    const load = React.useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchCounselorReferrals(tab)
            setRows(data)
            setPage(1)
        } catch (err: any) {
            toast.error(err?.message || "Failed to load referrals.")
        } finally {
            setLoading(false)
        }
    }, [tab])

    const refresh = React.useCallback(async () => {
        setRefreshing(true)
        try {
            const data = await fetchCounselorReferrals(tab)
            setRows(data)
        } catch {
            // silent
        } finally {
            setRefreshing(false)
        }
    }, [tab])

    React.useEffect(() => {
        load()
    }, [load])

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return rows

        return rows.filter((r) => {
            const studentName = (r.student?.name ?? r.student_name ?? "").toLowerCase()
            const studentEmail = (r.student?.email ?? r.student_email ?? "").toLowerCase()
            const reqName = (r.requestedBy?.name ?? r.requested_by_name ?? "").toLowerCase()
            const reqRole = (r.requestedBy?.role ?? r.requested_by_role ?? "").toLowerCase()
            const concern = (r.concern_type ?? "").toLowerCase()
            const urgency = (r.urgency ?? "").toLowerCase()
            const status = safeStr(r.status).toLowerCase()

            return (
                studentName.includes(q) ||
                studentEmail.includes(q) ||
                reqName.includes(q) ||
                reqRole.includes(q) ||
                concern.includes(q) ||
                urgency.includes(q) ||
                status.includes(q)
            )
        })
    }, [query, rows])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(Math.max(page, 1), totalPages)

    const pageItems = React.useMemo(() => {
        const start = (safePage - 1) * pageSize
        return filtered.slice(start, start + pageSize)
    }, [filtered, safePage])

    const quickUpdateStatus = React.useCallback(
        async (id: number | string, nextStatus: "pending" | "handled" | "closed") => {
            const prev = rows
            setRows((curr) => curr.map((r) => (String(r.id) === String(id) ? { ...r, status: nextStatus } : r)))

            try {
                const updated = await patchReferral(id, { status: nextStatus })
                setRows((curr) => curr.map((r) => (String(r.id) === String(id) ? updated : r)))
                toast.success("Referral updated.")
            } catch (err: any) {
                setRows(prev)
                toast.error(err?.message || "Failed to update referral.")
            }
        },
        [rows],
    )

    return (
        <DashboardLayout
            title="Referrals"
            description="Review referrals requested by Dean / Registrar / Program Chair. Track status, urgency, and who requested the referral."
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader className="gap-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    Counselor Referrals
                                    <Badge variant="outline" className="font-normal">
                                        {filtered.length} total
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Includes <span className="font-medium">Requested By</span> and <span className="font-medium">Student</span> details.
                                </CardDescription>
                            </div>

                            <div className="flex items-center gap-2">
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
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full sm:w-auto">
                                <TabsList>
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="pending">Pending</TabsTrigger>
                                    <TabsTrigger value="handled">Handled</TabsTrigger>
                                    <TabsTrigger value="closed">Closed</TabsTrigger>
                                </TabsList>
                                <TabsContent value={tab} className="hidden" />
                            </Tabs>

                            <div className="relative w-full sm:w-[360px]">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search student, requested by, concern, urgency..."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : pageItems.length === 0 ? (
                            <div className="rounded-lg border bg-muted/30 p-6 text-center">
                                <div className="text-sm font-medium">No referrals found</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Try changing the status filter or clearing your search.
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Requested By</TableHead>
                                            <TableHead>Concern</TableHead>
                                            <TableHead>Urgency</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {pageItems.map((r) => {
                                            const studentName = r.student?.name ?? r.student_name ?? "—"
                                            const studentEmail = r.student?.email ?? r.student_email ?? null

                                            const reqName = r.requestedBy?.name ?? r.requested_by_name ?? "—"
                                            const reqRole = r.requestedBy?.role ?? r.requested_by_role ?? null
                                            const reqEmail = r.requestedBy?.email ?? r.requested_by_email ?? null

                                            const officialOk = isOfficialEmail(reqEmail)

                                            return (
                                                <TableRow key={String(r.id)} className="align-top">
                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium">{studentName}</div>
                                                            {studentEmail ? (
                                                                <div className="text-xs text-muted-foreground">{studentEmail}</div>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium">{reqName}</div>

                                                                {!officialOk ? (
                                                                    <Badge variant="outline" className="gap-1 text-amber-600">
                                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                                        Non-official domain
                                                                    </Badge>
                                                                ) : null}
                                                            </div>

                                                            <div className="text-xs text-muted-foreground">
                                                                {reqRole ? <span className="capitalize">{reqRole}</span> : "—"}
                                                                {reqEmail ? <span className="ml-2">• {reqEmail}</span> : null}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium">{r.concern_type || "—"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Created: {toDateTimeLabel(r.created_at)}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        {r.urgency ? (
                                                            <Badge variant="outline" className="capitalize">
                                                                {r.urgency}
                                                            </Badge>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </TableCell>

                                                    <TableCell>{statusBadge(r.status)}</TableCell>

                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-2"
                                                                onClick={() => navigate(`/dashboard/counselor/referral-details?id=${encodeURIComponent(String(r.id))}`)}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                                View
                                                            </Button>

                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="px-2">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>

                                                                <DropdownMenuContent align="end" className="w-44">
                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            navigate(
                                                                                `/dashboard/counselor/referral-details?id=${encodeURIComponent(String(r.id))}`,
                                                                            )
                                                                        }
                                                                    >
                                                                        Open details
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem onClick={() => quickUpdateStatus(r.id, "pending")}>
                                                                        Mark as Pending
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem onClick={() => quickUpdateStatus(r.id, "handled")}>
                                                                        Mark as Handled
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem onClick={() => quickUpdateStatus(r.id, "closed")}>
                                                                        Mark as Closed
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

                        {!loading && filtered.length > 0 ? (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Showing <span className="font-medium">{(safePage - 1) * pageSize + 1}</span>–
                                    <span className="font-medium">{Math.min(safePage * pageSize, filtered.length)}</span> of{" "}
                                    <span className="font-medium">{filtered.length}</span>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={safePage <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <Badge variant="outline" className="font-normal">
                                        Page {safePage} / {totalPages}
                                    </Badge>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safePage >= totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        Official domain enforcement for referral users:{" "}
                        <span className="font-medium">@{getOfficialDomain()}</span>
                    </div>

                    <Link to="/dashboard/counselor" className="underline underline-offset-4 hover:text-foreground">
                        Back to Overview
                    </Link>
                </div>
            </div>
        </DashboardLayout>
    )
}
