/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowLeft,
    Save,
    RefreshCw,
    UserCircle2,
    ShieldAlert,
    BadgeInfo,
} from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

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

        remarks: raw?.remarks ?? null,
        handled_at: raw?.handled_at ?? null,
        closed_at: raw?.closed_at ?? null,

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

async function fetchReferralById(id: number | string) {
    // ✅ backend: GET /counselor/referrals/{id}
    const json = await counselorFetch<any>(`/counselor/referrals/${id}`, { method: "GET" })
    const ref = json?.referral ?? json
    return normalizeReferral(ref)
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

async function fetchCounselorsDirectory(search?: string): Promise<DirectoryUser[]> {
    const qs = new URLSearchParams()
    qs.set("role", "counselor")
    qs.set("limit", "50")
    if (search && search.trim()) qs.set("search", search.trim())

    // ✅ backend: GET /counselor/users?role=counselor&search=...
    const json = await counselorFetch<any>(`/counselor/users?${qs.toString()}`, { method: "GET" })
    const users = Array.isArray(json?.users) ? json.users : []
    return users.map((u: any) => ({
        id: u?.id ?? "",
        name: u?.name ?? null,
        email: u?.email ?? null,
        role: u?.role ?? null,
    }))
}

function statusBadge(status: ReferralStatus) {
    const s = safeStr(status).toLowerCase()

    if (s === "pending") {
        return (
            <Badge variant="secondary" className="capitalize">
                pending
            </Badge>
        )
    }

    if (s === "handled") {
        return <Badge className="capitalize">handled</Badge>
    }

    if (s === "closed") {
        return (
            <Badge variant="destructive" className="capitalize">
                closed
            </Badge>
        )
    }

    return <Badge variant="outline">{safeStr(status) || "unknown"}</Badge>
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
            const data = await fetchReferralById(id)
            setReferral(data)

            setStatus(data.status ?? "pending")
            setRemarks(data.remarks ?? "")

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
            const data = await fetchReferralById(id)
            setReferral(data)
            setStatus(data.status ?? "pending")
            setRemarks(data.remarks ?? "")
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

        try {
            const payload = {
                status: String(status || "").trim() || undefined,
                remarks: remarks?.trim?.() ? remarks.trim() : null,
                counselor_id: assignedCounselorId ? assignedCounselorId : null,
            }

            const updated = await patchReferral(referral.id, payload)
            setReferral(updated)

            setStatus(updated.status ?? status)
            setRemarks(updated.remarks ?? remarks)

            const currentCounselorId = updated.counselor?.id ? String(updated.counselor.id) : ""
            setAssignedCounselorId(currentCounselorId)

            toast.success("Referral updated successfully.")
        } catch (err: any) {
            toast.error(err?.message || "Failed to update referral.")
        }
    }, [assignedCounselorId, referral?.id, remarks, status])

    const studentName = referral?.student?.name ?? referral?.student_name ?? "—"
    const studentEmail = referral?.student?.email ?? referral?.student_email ?? null
    const requestedByName = referral?.requestedBy?.name ?? referral?.requested_by_name ?? "—"
    const requestedByRole = referral?.requestedBy?.role ?? referral?.requested_by_role ?? null
    const requestedByEmail = referral?.requestedBy?.email ?? referral?.requested_by_email ?? null
    const requestedByOfficial = isOfficialEmail(requestedByEmail)

    const currentCounselorName = referral?.counselor?.name ?? null
    const currentCounselorEmail = referral?.counselor?.email ?? null

    return (
        <DashboardLayout
            title="Referral Details"
            description="View referral information, Requested By, and update status or assign a counselor."
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

                    <Link
                        to="/dashboard/counselor/referrals"
                        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Go to Referrals List
                    </Link>
                </div>

                <Card>
                    <CardHeader className="gap-1">
                        <CardTitle className="flex items-center gap-2">
                            Referral #{id || "—"}
                            {referral ? statusBadge(referral.status) : null}
                        </CardTitle>
                        <CardDescription>Includes Student and Requested By information (with domain restriction awareness).</CardDescription>
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
                                {/* LEFT: People */}
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

                                                {!requestedByOfficial ? (
                                                    <Badge variant="outline" className="ml-auto gap-1 text-amber-600">
                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                        Non-official domain
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <div className="mt-2 space-y-0.5">
                                                <div className="text-sm font-semibold">{requestedByName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {requestedByRole ? <span className="capitalize">{requestedByRole}</span> : "—"}
                                                    {requestedByEmail ? <span className="ml-2">• {requestedByEmail}</span> : null}
                                                </div>

                                                {!requestedByOfficial ? (
                                                    <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                                        Official domain required for referral-user accounts:{" "}
                                                        <span className="font-semibold">@{getOfficialDomain()}</span>
                                                    </div>
                                                ) : null}
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

                                                                <div className="max-h-80 overflow-auto rounded-lg border">
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
                                                                                    <button
                                                                                        key={String(c.id)}
                                                                                        type="button"
                                                                                        className={cn(
                                                                                            "w-full cursor-pointer px-3 py-3 text-left transition-colors hover:bg-muted/40",
                                                                                            isSelected ? "bg-muted/40" : "",
                                                                                        )}
                                                                                        onClick={() => {
                                                                                            setAssignedCounselorId(String(c.id))
                                                                                            toast.message("Counselor selected (not saved yet).")
                                                                                            setAssignDialogOpen(false)
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                            <div className="min-w-0">
                                                                                                <div className="truncate text-sm font-medium">{c.name || "—"}</div>
                                                                                                <div className="truncate text-xs text-muted-foreground">
                                                                                                    {c.email || "—"}
                                                                                                </div>
                                                                                            </div>

                                                                                            {isSelected ? <Badge variant="outline">Selected</Badge> : null}
                                                                                        </div>
                                                                                    </button>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>

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

                                {/* RIGHT: Referral info + actions */}
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">Referral Information</CardTitle>
                                        <CardDescription>Review concern details and update status/remarks.</CardDescription>
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
                                            <Textarea value={referral.details || ""} readOnly className="min-h-[120px]" />
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
                                                className="min-h-[110px]"
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

                <div className="text-sm text-muted-foreground">
                    Note: Domain restriction for referral-user accounts is <span className="font-medium">@{getOfficialDomain()}</span>.
                </div>
            </div>
        </DashboardLayout>
    )
}
