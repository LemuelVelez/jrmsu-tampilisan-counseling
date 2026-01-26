/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "@/components/DashboardLayout"
import { toast } from "sonner"

import { AUTH_API_BASE_URL } from "@/api/auth/route"
import { getCurrentSession } from "@/lib/authentication"
import { normalizeRole } from "@/lib/role"
import { cn } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import {
    Loader2,
    RefreshCw,
    Search,
    Users,
    MessageCircle,
    UserRound,
    History,
    CalendarClock,
} from "lucide-react"

type DirectoryUser = {
    id: string | number
    name: string
    email: string
    role: string
    avatar_url?: string | null

    // optional student fields (if present)
    student_id?: string | null
    year_level?: string | null
    program?: string | null
    course?: string | null
    gender?: string | null

    created_at?: string | null
}

type PeerRole = "student" | "guest" | "counselor" | "admin"

type CounselorStudentProfile = {
    id: string | number
    name?: string | null
    email?: string | null
    role?: string | null
    avatar_url?: string | null

    student_id?: string | null
    year_level?: string | null
    program?: string | null
    course?: string | null
    gender?: string | null

    created_at?: string | null
    [key: string]: unknown
}

type CounselorStudentHistoryItem = {
    id: string | number
    date?: string | null
    concern?: string | null
    status?: string | null
    counselor?: string | null
    [key: string]: unknown
}

type PeerRoleFilter = "all" | "student" | "guest"

function isAbortError(err: unknown): boolean {
    const e = err as any
    return (
        e?.name === "AbortError" ||
        e?.code === 20 ||
        (typeof e?.message === "string" && e.message.toLowerCase().includes("aborted"))
    )
}

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.")
    }
    const trimmed = path.replace(/^\/+/, "")
    return `${AUTH_API_BASE_URL}/${trimmed}`
}

async function apiFetch<T>(
    path: string,
    init: RequestInit = {},
    token?: string | null,
): Promise<T> {
    const url = resolveApiUrl(path)

    const res = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
        },
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
        const firstErrorFromLaravel =
            data?.errors && typeof data.errors === "object"
                ? (Object.values(data.errors)[0] as any)?.[0]
                : undefined

        const msg =
            data?.message ||
            data?.error ||
            firstErrorFromLaravel ||
            res.statusText ||
            "Server request failed."

        throw new Error(msg)
    }

    return data as T
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload

    const candidates = [
        payload.users,
        payload.data,
        payload.results,
        payload.items,
        payload.records,
        payload?.payload?.users,
        payload?.payload?.data,
    ]

    for (const c of candidates) {
        if (Array.isArray(c)) return c
    }

    return []
}

function readStr(obj: any, key: string): string {
    const v = obj?.[key]
    if (v == null) return ""
    return String(v)
}

function getInitials(name?: string | null, email?: string | null): string {
    const base = (name ?? "").trim()
    if (base) {
        const parts = base.split(/\s+/)
        if (parts.length === 1) return (parts[0][0] ?? "U").toUpperCase()
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`
            .toUpperCase()
            .slice(0, 2)
    }
    return (email?.[0] ?? "U").toUpperCase()
}

function getApiOrigin(): string {
    if (!AUTH_API_BASE_URL) return ""
    try {
        return new URL(AUTH_API_BASE_URL).origin
    } catch {
        return ""
    }
}

function looksLikeFilePath(s: string): boolean {
    // Heuristic: contains a file extension OR common avatar folders
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    )
}

/**
 * Supports common Laravel avatar storage formats:
 * - "avatars/foo.jpg"                 -> "/storage/avatars/foo.jpg"
 * - "public/avatars/foo.jpg"          -> "/storage/avatars/foo.jpg"
 * - "storage/app/public/avatars/..."  -> "/storage/avatars/..."
 * - "/storage/avatars/foo.jpg"        -> "/storage/avatars/foo.jpg"
 * - Absolute URLs stay untouched
 */
function resolveAvatarSrc(raw?: string | null): string | null {
    const s0 = typeof raw === "string" ? raw : ""
    let s = s0.trim()
    if (!s) return null

    // normalize any backslashes coming from storage paths
    s = s.replace(/\\/g, "/")

    // already absolute or special
    if (/^(data:|blob:)/i.test(s)) return s
    if (/^https?:\/\//i.test(s)) return s
    if (s.startsWith("//")) return `${window.location.protocol}${s}`

    // Strip common Laravel prefixes
    s = s.replace(/^storage\/app\/public\//i, "")
    s = s.replace(/^public\//i, "")

    const normalized = s.replace(/^\/+/, "")
    const alreadyStorage =
        normalized.toLowerCase().startsWith("storage/") ||
        normalized.toLowerCase().startsWith("api/storage/")

    let path = normalized

    if (!alreadyStorage && looksLikeFilePath(normalized)) {
        path = `storage/${normalized}`
    }

    const finalPath = path.startsWith("/") ? path : `/${path}`

    const origin = getApiOrigin()
    return origin ? `${origin}${finalPath}` : finalPath
}

function pickAvatarUrl(u: any): string | null {
    const candidates = [
        u?.avatar_url,
        u?.avatarUrl,
        u?.avatar,
        u?.profile_picture,
        u?.profile_picture_url,
        u?.profile_photo_url,
        u?.photo_url,
        u?.image_url,
        u?.picture,
        u?.photo,
    ]

    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim()
    }
    return null
}

function mapToDirectoryUser(raw: any): DirectoryUser | null {
    const u = raw?.user ?? raw

    const id = u?.id ?? u?.user_id ?? u?.student_id ?? u?.guest_id
    const email = readStr(u, "email").trim()

    if (id == null || String(id).trim() === "") return null
    if (!email) return null

    const name = readStr(u, "name").trim() || email
    const roleRaw = readStr(u, "role").trim() || readStr(u, "user_role").trim()
    const roleNorm = normalizeRole(roleRaw)

    const avatarRaw = pickAvatarUrl(u) ?? pickAvatarUrl(raw) ?? null

    return {
        id,
        name,
        email,
        role: roleRaw || roleNorm || "user",
        avatar_url: avatarRaw,

        student_id: readStr(u, "student_id") || null,
        year_level: readStr(u, "year_level") || null,
        program: readStr(u, "program") || null,
        course: readStr(u, "course") || null,
        gender: readStr(u, "gender") || null,

        created_at: readStr(u, "created_at") || null,
    }
}

/**
 * Tries multiple endpoints and merges results for student + guest.
 * signal is used so we can abort in-flight loads on unmount/refresh.
 */
async function fetchCounselorStudentAndGuestUsers(
    token?: string | null,
    signal?: AbortSignal,
): Promise<DirectoryUser[]> {
    const endpoints = [
        // counselor-scoped
        "/counselor/users?roles=student,guest",
        "/counselor/users?role=student",
        "/counselor/users?role=guest",
        "/counselor/students",
        "/counselor/guests",

        // generic
        "/users?roles=student,guest",
        "/users?role=student",
        "/users?role=guest",
        "/students",
        "/guests",
    ]

    const merged: DirectoryUser[] = []
    const seen = new Set<string>()

    let lastErr: any = null

    for (const path of endpoints) {
        if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError")
        }

        try {
            const data = await apiFetch<any>(path, { method: "GET", signal }, token)
            const arr = extractUsersArray(data)

            const mapped = arr.map(mapToDirectoryUser).filter(Boolean) as DirectoryUser[]

            for (const u of mapped) {
                const key = String(u.id)
                if (seen.has(key)) continue

                // Only keep student/guest-ish roles (best-effort)
                const r = normalizeRole(u.role ?? "")
                const looksValid = r.includes("student") || r.includes("guest")
                if (!looksValid && (path.includes("students") || path.includes("guests"))) {
                    // endpoint is specific, keep it
                } else if (!looksValid) {
                    continue
                }

                seen.add(key)
                merged.push(u)
            }
        } catch (e) {
            if (isAbortError(e)) throw e
            lastErr = e
            // keep trying next candidate
        }
    }

    if (merged.length === 0 && lastErr) throw lastErr
    return merged
}

/**
 * Counselor Student Profile endpoints
 * - GET /counselor/students/{id}
 * - GET /counselor/students/{id}/history
 */
function extractProfile(payload: any): any | null {
    if (!payload) return null
    if (typeof payload === "object") {
        return payload.student ?? payload.data ?? payload.user ?? payload.profile ?? payload
    }
    return null
}

function extractHistoryArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload

    const candidates = [
        payload.history,
        payload.appointments,
        payload.data,
        payload.items,
        payload.records,
        payload.results,
        payload?.payload?.history,
        payload?.payload?.appointments,
        payload?.payload?.data,
    ]

    for (const c of candidates) {
        if (Array.isArray(c)) return c
    }

    return []
}

function formatDateLabel(value?: string | null): string {
    const v = (value ?? "").trim()
    if (!v) return "—"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function mapHistoryItem(raw: any, fallbackIndex: number): CounselorStudentHistoryItem {
    const item = raw?.appointment ?? raw

    const id =
        item?.id ??
        item?.appointment_id ??
        item?.request_id ??
        item?.intake_id ??
        `row-${fallbackIndex}`

    const date =
        readStr(item, "scheduled_at") ||
        readStr(item, "schedule_at") ||
        readStr(item, "appointment_date") ||
        readStr(item, "requested_at") ||
        readStr(item, "created_at") ||
        null

    const concern =
        readStr(item, "concern") ||
        readStr(item, "reason") ||
        readStr(item, "concerns") ||
        readStr(item, "issue") ||
        readStr(item, "problem") ||
        readStr(item, "description") ||
        readStr(item, "notes") ||
        null

    const status =
        readStr(item, "status") ||
        readStr(item, "state") ||
        readStr(item, "appointment_status") ||
        null

    const counselor =
        readStr(item, "counselor_name") ||
        readStr(item, "counselor") ||
        readStr(item, "handled_by") ||
        null

    return {
        id,
        date: date || null,
        concern: concern || null,
        status: status || null,
        counselor: counselor || null,
        raw: item,
    }
}

async function fetchCounselorStudentProfile(
    id: string | number,
    token?: string | null,
    signal?: AbortSignal,
): Promise<CounselorStudentProfile | null> {
    const path = `/counselor/students/${encodeURIComponent(String(id))}`

    const payload = await apiFetch<any>(path, { method: "GET", signal }, token)
    const p = extractProfile(payload)

    if (!p) return null

    return {
        id: p?.id ?? id,
        name: p?.name ?? null,
        email: p?.email ?? null,
        role: p?.role ?? null,
        avatar_url: pickAvatarUrl(p) ?? null,
        student_id: p?.student_id ?? null,
        year_level: p?.year_level ?? null,
        program: p?.program ?? null,
        course: p?.course ?? null,
        gender: p?.gender ?? null,
        created_at: p?.created_at ?? null,
        ...p,
    }
}

async function fetchCounselorStudentHistory(
    id: string | number,
    token?: string | null,
    signal?: AbortSignal,
): Promise<CounselorStudentHistoryItem[]> {
    const path = `/counselor/students/${encodeURIComponent(String(id))}/history`

    const payload = await apiFetch<any>(path, { method: "GET", signal }, token)
    const arr = extractHistoryArray(payload)

    return arr.map((x, i) => mapHistoryItem(x, i))
}

const CounselorUsers: React.FC = () => {
    const navigate = useNavigate()

    const session = getCurrentSession()
    const token = (session as any)?.token ?? null

    const [isLoading, setIsLoading] = React.useState(true)
    const [isRefreshing, setIsRefreshing] = React.useState(false)

    const [query, setQuery] = React.useState("")
    const [roleFilter, setRoleFilter] = React.useState<PeerRoleFilter>("all")

    const [users, setUsers] = React.useState<DirectoryUser[]>([])

    // ✅ Prevent unhandled promises / state updates after unmount
    const abortRef = React.useRef<AbortController | null>(null)
    const mountedRef = React.useRef(true)

    React.useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            abortRef.current?.abort()
            abortRef.current = null
        }
    }, [])

    const load = React.useCallback(
        async (mode: "initial" | "refresh") => {
            // Abort any previous in-flight load
            abortRef.current?.abort()
            abortRef.current = new AbortController()

            if (mode === "initial") {
                if (mountedRef.current) setIsLoading(true)
            } else {
                if (mountedRef.current) setIsRefreshing(true)
            }

            try {
                const res = await fetchCounselorStudentAndGuestUsers(token, abortRef.current.signal)
                if (mountedRef.current) setUsers(res)
            } catch (err) {
                // Ignore aborts (navigation/refresh)
                if (isAbortError(err)) return

                if (mountedRef.current) {
                    toast.error(err instanceof Error ? err.message : "Failed to load users.")
                }
            } finally {
                if (mountedRef.current) {
                    setIsLoading(false)
                    setIsRefreshing(false)
                }
            }
        },
        [token],
    )

    React.useEffect(() => {
        // ✅ Ensure no unhandled rejection even if something escapes
        load("initial").catch((e) => {
            console.error("[CounselorUsers] load(initial) unhandled:", e)
        })
    }, [load])

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()

        return users.filter((u) => {
            const r = normalizeRole(u.role ?? "")
            const roleOk =
                roleFilter === "all" ||
                (roleFilter === "student" && r.includes("student")) ||
                (roleFilter === "guest" && r.includes("guest"))

            if (!roleOk) return false

            if (!q) return true

            const hay = [
                u.name,
                u.email,
                u.role,
                u.student_id ?? "",
                u.program ?? "",
                u.course ?? "",
                u.year_level ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [users, query, roleFilter])

    const counts = React.useMemo(() => {
        let students = 0
        let guests = 0

        for (const u of users) {
            const r = normalizeRole(u.role ?? "")
            if (r.includes("student")) students += 1
            else if (r.includes("guest")) guests += 1
        }

        return {
            all: users.length,
            student: students,
            guest: guests,
        }
    }, [users])

    const FilterButton = (props: { value: PeerRoleFilter; label: string; count: number }) => {
        const active = roleFilter === props.value
        return (
            <Button
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(props.value)}
                className={cn("h-9 justify-between gap-2 rounded-full px-4 text-xs", active ? "" : "bg-white")}
            >
                <span className="truncate">{props.label}</span>
                <Badge variant="secondary" className="rounded-full text-xs">
                    {props.count}
                </Badge>
            </Button>
        )
    }

    const startMessage = (u: DirectoryUser) => {
        const roleNorm = normalizeRole(u.role ?? "")
        let role: PeerRole | null = null

        if (roleNorm.includes("student")) role = "student"
        else if (roleNorm.includes("guest")) role = "guest"

        if (!role) {
            toast.error("This page only supports messaging Students and Guests.")
            return
        }

        navigate("/dashboard/counselor/messages", {
            state: {
                autoStartConversation: {
                    role,
                    id: u.id,
                    name: u.name,
                },
            },
        })
    }

    /**
     * ✅ Student Profile Modal (Counselor View)
     */
    const [profileOpen, setProfileOpen] = React.useState(false)
    const [profileUser, setProfileUser] = React.useState<DirectoryUser | null>(null)

    const [profileLoading, setProfileLoading] = React.useState(false)
    const [profileData, setProfileData] = React.useState<CounselorStudentProfile | null>(null)

    const [historyLoading, setHistoryLoading] = React.useState(false)
    const [historyRows, setHistoryRows] = React.useState<CounselorStudentHistoryItem[]>([])

    const studentModalAbortRef = React.useRef<AbortController | null>(null)

    const closeStudentModal = React.useCallback(() => {
        studentModalAbortRef.current?.abort()
        studentModalAbortRef.current = null

        setProfileOpen(false)
        setProfileUser(null)
        setProfileData(null)
        setHistoryRows([])
        setProfileLoading(false)
        setHistoryLoading(false)
    }, [])

    const openStudentProfile = React.useCallback(
        async (u: DirectoryUser) => {
            const r = normalizeRole(u.role ?? "")
            if (!r.includes("student")) {
                toast.error("Student Profile & History are available for Student accounts only.")
                return
            }

            // reset + open
            setProfileOpen(true)
            setProfileUser(u)
            setProfileData(null)
            setHistoryRows([])

            // abort any previous modal fetch
            studentModalAbortRef.current?.abort()
            studentModalAbortRef.current = new AbortController()

            const signal = studentModalAbortRef.current.signal

            setProfileLoading(true)
            setHistoryLoading(true)

            try {
                const [p, h] = await Promise.all([
                    fetchCounselorStudentProfile(u.id, token, signal).catch((e) => {
                        if (!isAbortError(e)) console.error("[CounselorUsers] profile fetch error:", e)
                        return null
                    }),
                    fetchCounselorStudentHistory(u.id, token, signal).catch((e) => {
                        if (!isAbortError(e)) console.error("[CounselorUsers] history fetch error:", e)
                        return [] as CounselorStudentHistoryItem[]
                    }),
                ])

                if (!signal.aborted) {
                    setProfileData(p)
                    setHistoryRows(Array.isArray(h) ? h : [])
                }
            } catch (e) {
                if (isAbortError(e)) return
                toast.error(e instanceof Error ? e.message : "Failed to load student profile.")
            } finally {
                if (!signal.aborted) {
                    setProfileLoading(false)
                    setHistoryLoading(false)
                }
            }
        },
        [token],
    )

    const activeStudentName = profileData?.name ?? profileUser?.name ?? "Student"

    const avatarForModalRaw =
        (typeof profileData?.avatar_url === "string" && profileData.avatar_url.trim()
            ? profileData.avatar_url.trim()
            : typeof profileUser?.avatar_url === "string" && profileUser.avatar_url.trim()
                ? profileUser.avatar_url.trim()
                : null) ?? null

    const modalAvatarSrc = resolveAvatarSrc(avatarForModalRaw)

    const modalEmail = (profileData?.email ?? profileUser?.email ?? "").trim()
    const modalStudentId = (profileData?.student_id ?? profileUser?.student_id ?? "").trim()
    const modalYear = (profileData?.year_level ?? profileUser?.year_level ?? "").trim()
    const modalProgram = (profileData?.program ?? profileUser?.program ?? "").trim()
    const modalCourse = (profileData?.course ?? profileUser?.course ?? "").trim()
    const modalGender = (profileData?.gender ?? profileUser?.gender ?? "").trim()

    const profileInitials = getInitials(activeStudentName, modalEmail)

    const historyCount = historyRows.length

    return (
        <DashboardLayout title="Users" description="View student and guest accounts in your system.">
            <div className="mx-auto w-full space-y-6 px-4">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Users className="h-4 w-4" />
                                    Students & Guests
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Search and filter users. (Read-only)
                                </CardDescription>
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <div className="relative w-full sm:w-80">
                                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search name, email, ID, program…"
                                        className="h-9 pl-8 text-sm"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        load("refresh").catch((e) => {
                                            console.error("[CounselorUsers] load(refresh) unhandled:", e)
                                        })
                                    }}
                                    disabled={isRefreshing || isLoading}
                                    className="h-9 w-full gap-2 sm:w-auto"
                                    aria-label="Refresh"
                                >
                                    {isRefreshing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <FilterButton value="all" label="All" count={counts.all} />
                            <FilterButton value="student" label="Students" count={counts.student} />
                            <FilterButton value="guest" label="Guests" count={counts.guest} />
                        </div>

                        <Separator />

                        <div className="text-xs text-muted-foreground">
                            Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                            <span className="font-medium text-foreground">{users.length}</span> users
                        </div>
                    </CardHeader>

                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading users…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">
                                No users found.
                            </div>
                        ) : (
                            <>
                                {/* Mobile */}
                                <div className="space-y-3 sm:hidden">
                                    {filtered.map((u) => {
                                        const initials = getInitials(u.name, u.email)

                                        const avatarUrlRaw =
                                            typeof u.avatar_url === "string" && u.avatar_url.trim()
                                                ? u.avatar_url.trim()
                                                : null

                                        const avatarSrc = resolveAvatarSrc(avatarUrlRaw)

                                        const r = normalizeRole(u.role ?? "")
                                        const isStudent = r.includes("student")
                                        const roleLabelText = isStudent
                                            ? "Student"
                                            : r.includes("guest")
                                                ? "Guest"
                                                : u.role || "User"

                                        return (
                                            <div key={String(u.id)} className="rounded-xl border bg-white/70 p-3">
                                                <div className="overflow-x-auto">
                                                    <div className="min-w-max pr-2">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-10 w-10 border">
                                                                <AvatarImage
                                                                    src={avatarSrc ?? undefined}
                                                                    alt={u.name ?? "User avatar"}
                                                                    className="object-cover"
                                                                    loading="lazy"
                                                                />
                                                                <AvatarFallback className="text-xs font-semibold">
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>

                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="space-y-0.5">
                                                                    <div className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                                                        {u.name}
                                                                    </div>
                                                                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                                                                        {u.email}
                                                                    </div>
                                                                </div>

                                                                <Badge
                                                                    variant="secondary"
                                                                    className="shrink-0 whitespace-nowrap text-xs"
                                                                >
                                                                    {roleLabelText}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {u.student_id || u.program || u.year_level || u.course ? (
                                                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                                                {u.student_id ? (
                                                                    <div className="flex justify-between gap-6 whitespace-nowrap">
                                                                        <span className="text-slate-700">
                                                                            Student ID
                                                                        </span>
                                                                        <span>{u.student_id}</span>
                                                                    </div>
                                                                ) : null}
                                                                {u.year_level ? (
                                                                    <div className="flex justify-between gap-6 whitespace-nowrap">
                                                                        <span className="text-slate-700">Year</span>
                                                                        <span>{u.year_level}</span>
                                                                    </div>
                                                                ) : null}
                                                                {u.program ? (
                                                                    <div className="flex justify-between gap-6 whitespace-nowrap">
                                                                        <span className="text-slate-700">Program</span>
                                                                        <span>{u.program}</span>
                                                                    </div>
                                                                ) : null}
                                                                {u.course ? (
                                                                    <div className="flex justify-between gap-6 whitespace-nowrap">
                                                                        <span className="text-slate-700">Course</span>
                                                                        <span>{u.course}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="mt-3 grid grid-cols-1 gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full gap-2"
                                                        onClick={() => openStudentProfile(u)}
                                                        disabled={!isStudent}
                                                    >
                                                        <UserRound className="h-4 w-4" />
                                                        Student Profile & History
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full gap-2"
                                                        onClick={() => startMessage(u)}
                                                    >
                                                        <MessageCircle className="h-4 w-4" />
                                                        Message
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Desktop/tablet */}
                                <div className="hidden overflow-auto rounded-md border bg-white sm:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Avatar</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="w-28">Role</TableHead>
                                                <TableHead className="w-36">Student ID</TableHead>
                                                <TableHead>Program</TableHead>
                                                <TableHead className="w-32 text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filtered.map((u) => {
                                                const initials = getInitials(u.name, u.email)

                                                const avatarUrlRaw =
                                                    typeof u.avatar_url === "string" && u.avatar_url.trim()
                                                        ? u.avatar_url.trim()
                                                        : null

                                                const avatarSrc = resolveAvatarSrc(avatarUrlRaw)

                                                const r = normalizeRole(u.role ?? "")
                                                const isStudent = r.includes("student")
                                                const roleLabelText = isStudent
                                                    ? "Student"
                                                    : r.includes("guest")
                                                        ? "Guest"
                                                        : u.role || "User"

                                                return (
                                                    <TableRow key={String(u.id)}>
                                                        <TableCell>
                                                            <Avatar className="h-9 w-9 border">
                                                                <AvatarImage
                                                                    src={avatarSrc ?? undefined}
                                                                    alt={u.name ?? "User avatar"}
                                                                    className="object-cover"
                                                                    loading="lazy"
                                                                />
                                                                <AvatarFallback className="text-xs font-semibold">
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <div className="font-medium text-foreground">{u.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                ID: {String(u.id)}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {u.email}
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {roleLabelText}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {u.student_id ?? "—"}
                                                        </TableCell>

                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {u.program ? (
                                                                <div className="min-w-0">
                                                                    <div className="truncate">{u.program}</div>
                                                                    {u.year_level || u.course ? (
                                                                        <div className="truncate text-xs">
                                                                            {[u.year_level, u.course]
                                                                                .filter(Boolean)
                                                                                .join(" • ")}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    onClick={() => openStudentProfile(u)}
                                                                    disabled={!isStudent}
                                                                >
                                                                    <UserRound className="h-4 w-4" />
                                                                    Profile
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    onClick={() => startMessage(u)}
                                                                >
                                                                    <MessageCircle className="h-4 w-4" />
                                                                    Message
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* ✅ Student Profile + History Modal */}
                <Dialog
                    open={profileOpen}
                    onOpenChange={(open) => {
                        if (!open) closeStudentModal()
                    }}
                >
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <UserRound className="h-5 w-5" />
                                Student Profile
                            </DialogTitle>
                            <DialogDescription>
                                Counselor-only view of student profile details and appointment history.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Header card */}
                            <div className="rounded-xl border bg-white/70 p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12 border">
                                            <AvatarImage
                                                src={modalAvatarSrc ?? undefined}
                                                alt={activeStudentName}
                                                className="object-cover"
                                                loading="lazy"
                                            />
                                            <AvatarFallback className="text-sm font-semibold">
                                                {profileInitials}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="space-y-0.5">
                                            <div className="text-sm font-semibold text-slate-900">
                                                {activeStudentName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{modalEmail || "—"}</div>

                                            {modalStudentId ? (
                                                <div className="text-xs text-muted-foreground">
                                                    Student ID: <span className="text-foreground">{modalStudentId}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="gap-1 text-xs">
                                            <History className="h-3.5 w-3.5" />
                                            History: {historyLoading ? "…" : historyCount}
                                        </Badge>

                                        <Badge variant="secondary" className="gap-1 text-xs">
                                            <CalendarClock className="h-3.5 w-3.5" />
                                            Counselor View
                                        </Badge>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div className="flex items-center justify-between rounded-lg border bg-white/70 px-3 py-2 text-xs">
                                        <span className="text-muted-foreground">Year Level</span>
                                        <span className="font-medium text-foreground">{modalYear || "—"}</span>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border bg-white/70 px-3 py-2 text-xs">
                                        <span className="text-muted-foreground">Gender</span>
                                        <span className="font-medium text-foreground">{modalGender || "—"}</span>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border bg-white/70 px-3 py-2 text-xs sm:col-span-2">
                                        <span className="text-muted-foreground">Program</span>
                                        <span className="font-medium text-foreground">{modalProgram || "—"}</span>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border bg-white/70 px-3 py-2 text-xs sm:col-span-2">
                                        <span className="text-muted-foreground">Course</span>
                                        <span className="font-medium text-foreground">{modalCourse || "—"}</span>
                                    </div>
                                </div>

                                {(profileLoading || historyLoading) && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading student data…
                                    </div>
                                )}
                            </div>

                            {/* History */}
                            <div className="rounded-xl border bg-white/70 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        <div className="text-sm font-semibold text-slate-900">Student History</div>
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        {historyLoading ? "Loading…" : `${historyRows.length} record(s)`}
                                    </div>
                                </div>

                                {historyLoading ? (
                                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Fetching counseling history…
                                    </div>
                                ) : historyRows.length === 0 ? (
                                    <div className="rounded-lg border bg-white/60 p-3 text-sm text-muted-foreground">
                                        No appointment history found for this student.
                                    </div>
                                ) : (
                                    <div className="max-h-72 overflow-auto rounded-lg border bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-48">Date</TableHead>
                                                    <TableHead>Concern / Reason</TableHead>
                                                    <TableHead className="w-28">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {historyRows.map((row) => (
                                                    <TableRow key={String(row.id)}>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {formatDateLabel(row.date ?? null)}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            <div className="text-foreground">
                                                                {row.concern?.trim() ? row.concern : "—"}
                                                            </div>
                                                            {row.counselor?.trim() ? (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Counselor: {row.counselor}
                                                                </div>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {(row.status ?? "—").trim() || "—"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button type="button" variant="outline" onClick={closeStudentModal}>
                                Close
                            </Button>

                            {profileUser ? (
                                <Button
                                    type="button"
                                    className="gap-2"
                                    onClick={() => {
                                        // quick action: message student from profile view
                                        startMessage(profileUser)
                                        closeStudentModal()
                                    }}
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    Message Student
                                </Button>
                            ) : null}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}

export default CounselorUsers
