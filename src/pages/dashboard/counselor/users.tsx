/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import { getCurrentSession } from "@/lib/authentication";
import { normalizeRole } from "@/lib/role";
import { cn } from "@/lib/utils";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { Loader2, RefreshCw, Search, Users, MessageCircle } from "lucide-react";

type DirectoryUser = {
    id: string | number;
    name: string;
    email: string;
    role: string;
    avatar_url?: string | null;

    // optional student fields (if present)
    student_id?: string | null;
    year_level?: string | null;
    program?: string | null;
    course?: string | null;
    gender?: string | null;

    created_at?: string | null;
};

type PeerRole = "student" | "guest" | "counselor" | "admin";

function isAbortError(err: unknown): boolean {
    const e = err as any;
    return (
        e?.name === "AbortError" ||
        e?.code === 20 ||
        (typeof e?.message === "string" &&
            e.message.toLowerCase().includes("aborted"))
    );
}

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function apiFetch<T>(
    path: string,
    init: RequestInit = {},
    token?: string | null,
): Promise<T> {
    const url = resolveApiUrl(path);

    const res = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
        },
        credentials: "include",
    });

    const text = await res.text();
    let data: any = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        const firstErrorFromLaravel =
            data?.errors && typeof data.errors === "object"
                ? (Object.values(data.errors)[0] as any)?.[0]
                : undefined;

        const msg =
            data?.message ||
            data?.error ||
            firstErrorFromLaravel ||
            res.statusText ||
            "Server request failed.";

        throw new Error(msg);
    }

    return data as T;
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const candidates = [
        payload.users,
        payload.data,
        payload.results,
        payload.items,
        payload.records,
        payload?.payload?.users,
        payload?.payload?.data,
    ];

    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    return [];
}

function readStr(obj: any, key: string): string {
    const v = obj?.[key];
    if (v == null) return "";
    return String(v);
}

function getInitials(name?: string | null, email?: string | null): string {
    const base = (name ?? "").trim();
    if (base) {
        const parts = base.split(/\s+/);
        if (parts.length === 1) return (parts[0][0] ?? "U").toUpperCase();
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`
            .toUpperCase()
            .slice(0, 2);
    }
    return (email?.[0] ?? "U").toUpperCase();
}

function getApiOrigin(): string {
    if (!AUTH_API_BASE_URL) return "";
    try {
        return new URL(AUTH_API_BASE_URL).origin;
    } catch {
        return "";
    }
}

function looksLikeFilePath(s: string): boolean {
    // Heuristic: contains a file extension OR common avatar folders
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    );
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
    const s0 = typeof raw === "string" ? raw : "";
    let s = s0.trim();
    if (!s) return null;

    // normalize any backslashes coming from storage paths
    s = s.replace(/\\/g, "/");

    // already absolute or special
    if (/^(data:|blob:)/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return `${window.location.protocol}${s}`;

    // Strip common Laravel prefixes
    s = s.replace(/^storage\/app\/public\//i, "");
    s = s.replace(/^public\//i, "");

    const normalized = s.replace(/^\/+/, "");
    const alreadyStorage =
        normalized.toLowerCase().startsWith("storage/") ||
        normalized.toLowerCase().startsWith("api/storage/");

    let path = normalized;

    if (!alreadyStorage && looksLikeFilePath(normalized)) {
        path = `storage/${normalized}`;
    }

    const finalPath = path.startsWith("/") ? path : `/${path}`;

    const origin = getApiOrigin();
    return origin ? `${origin}${finalPath}` : finalPath;
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
    ];

    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
    }
    return null;
}

function mapToDirectoryUser(raw: any): DirectoryUser | null {
    const u = raw?.user ?? raw;

    const id = u?.id ?? u?.user_id ?? u?.student_id ?? u?.guest_id;
    const email = readStr(u, "email").trim();

    if (id == null || String(id).trim() === "") return null;
    if (!email) return null;

    const name = readStr(u, "name").trim() || email;
    const roleRaw = readStr(u, "role").trim() || readStr(u, "user_role").trim();
    const roleNorm = normalizeRole(roleRaw);

    const avatarRaw = pickAvatarUrl(u) ?? pickAvatarUrl(raw) ?? null;

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
    };
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
    ];

    const merged: DirectoryUser[] = [];
    const seen = new Set<string>();

    let lastErr: any = null;

    for (const path of endpoints) {
        if (signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        try {
            const data = await apiFetch<any>(
                path,
                { method: "GET", signal },
                token,
            );
            const arr = extractUsersArray(data);

            const mapped = arr
                .map(mapToDirectoryUser)
                .filter(Boolean) as DirectoryUser[];

            for (const u of mapped) {
                const key = String(u.id);
                if (seen.has(key)) continue;

                // Only keep student/guest-ish roles (best-effort)
                const r = normalizeRole(u.role ?? "");
                const looksValid = r.includes("student") || r.includes("guest");
                if (!looksValid && (path.includes("students") || path.includes("guests"))) {
                    // endpoint is specific, keep it
                } else if (!looksValid) {
                    continue;
                }

                seen.add(key);
                merged.push(u);
            }
        } catch (e) {
            if (isAbortError(e)) throw e;
            lastErr = e;
            // keep trying next candidate
        }
    }

    if (merged.length === 0 && lastErr) throw lastErr;
    return merged;
}

type RoleFilter = "all" | "student" | "guest";

const CounselorUsers: React.FC = () => {
    const navigate = useNavigate();

    const session = getCurrentSession();
    const token = (session as any)?.token ?? null;

    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [query, setQuery] = React.useState("");
    const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("all");

    const [users, setUsers] = React.useState<DirectoryUser[]>([]);

    // ✅ Prevent unhandled promises / state updates after unmount
    const abortRef = React.useRef<AbortController | null>(null);
    const mountedRef = React.useRef(true);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            abortRef.current?.abort();
            abortRef.current = null;
        };
    }, []);

    const load = React.useCallback(
        async (mode: "initial" | "refresh") => {
            // Abort any previous in-flight load
            abortRef.current?.abort();
            abortRef.current = new AbortController();

            if (mode === "initial") {
                if (mountedRef.current) setIsLoading(true);
            } else {
                if (mountedRef.current) setIsRefreshing(true);
            }

            try {
                const res = await fetchCounselorStudentAndGuestUsers(
                    token,
                    abortRef.current.signal,
                );
                if (mountedRef.current) setUsers(res);
            } catch (err) {
                // Ignore aborts (navigation/refresh)
                if (isAbortError(err)) return;

                if (mountedRef.current) {
                    toast.error(err instanceof Error ? err.message : "Failed to load users.");
                }
            } finally {
                if (mountedRef.current) {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        },
        [token],
    );

    React.useEffect(() => {
        // ✅ Ensure no unhandled rejection even if something escapes
        load("initial").catch((e) => {
            // This should be extremely rare now; keep it quiet but visible in dev
            console.error("[CounselorUsers] load(initial) unhandled:", e);
        });
    }, [load]);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();

        return users.filter((u) => {
            const r = normalizeRole(u.role ?? "");
            const roleOk =
                roleFilter === "all" ||
                (roleFilter === "student" && r.includes("student")) ||
                (roleFilter === "guest" && r.includes("guest"));

            if (!roleOk) return false;

            if (!q) return true;

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
                .toLowerCase();

            return hay.includes(q);
        });
    }, [users, query, roleFilter]);

    const counts = React.useMemo(() => {
        let students = 0;
        let guests = 0;

        for (const u of users) {
            const r = normalizeRole(u.role ?? "");
            if (r.includes("student")) students += 1;
            else if (r.includes("guest")) guests += 1;
        }

        return {
            all: users.length,
            student: students,
            guest: guests,
        };
    }, [users]);

    const FilterButton = (props: {
        value: RoleFilter;
        label: string;
        count: number;
    }) => {
        const active = roleFilter === props.value;
        return (
            <Button
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setRoleFilter(props.value)}
                className={cn(
                    "h-9 justify-between gap-2 rounded-full px-4 text-xs",
                    active ? "" : "bg-white",
                )}
            >
                <span className="truncate">{props.label}</span>
                <Badge variant="secondary" className="rounded-full text-[0.70rem]">
                    {props.count}
                </Badge>
            </Button>
        );
    };

    const startMessage = (u: DirectoryUser) => {
        const roleNorm = normalizeRole(u.role ?? "");
        let role: PeerRole | null = null;

        if (roleNorm.includes("student")) role = "student";
        else if (roleNorm.includes("guest")) role = "guest";

        if (!role) {
            toast.error("This page only supports messaging Students and Guests.");
            return;
        }

        navigate("/dashboard/counselor/messages", {
            state: {
                autoStartConversation: {
                    role,
                    id: u.id,
                    name: u.name,
                },
            },
        });
    };

    return (
        <DashboardLayout
            title="Users"
            description="View student and guest accounts in your system."
        >
            <div className="mx-auto w-full px-4 space-y-6">
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
                                <div className="relative w-full sm:w-[320px]">
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
                                            console.error("[CounselorUsers] load(refresh) unhandled:", e);
                                        });
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
                            Showing{" "}
                            <span className="font-medium text-foreground">{filtered.length}</span>{" "}
                            of{" "}
                            <span className="font-medium text-foreground">{users.length}</span>{" "}
                            users
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
                                        const initials = getInitials(u.name, u.email);

                                        const avatarUrlRaw =
                                            typeof u.avatar_url === "string" && u.avatar_url.trim()
                                                ? u.avatar_url.trim()
                                                : null;

                                        const avatarSrc = resolveAvatarSrc(avatarUrlRaw);

                                        const r = normalizeRole(u.role ?? "");
                                        const roleLabelText = r.includes("student")
                                            ? "Student"
                                            : r.includes("guest")
                                                ? "Guest"
                                                : (u.role || "User");

                                        return (
                                            <div
                                                key={String(u.id)}
                                                className="rounded-xl border bg-white/70 p-3"
                                            >
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
                                                                    className="shrink-0 whitespace-nowrap text-[0.70rem]"
                                                                >
                                                                    {roleLabelText}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {(u.student_id || u.program || u.year_level || u.course) ? (
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

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-3 w-full gap-2"
                                                    onClick={() => startMessage(u)}
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    Message
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop/tablet */}
                                <div className="hidden overflow-auto rounded-md border bg-white sm:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[70px]">Avatar</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="w-[120px]">Role</TableHead>
                                                <TableHead className="w-[140px]">Student ID</TableHead>
                                                <TableHead>Program</TableHead>
                                                <TableHead className="w-[130px] text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filtered.map((u) => {
                                                const initials = getInitials(u.name, u.email);

                                                const avatarUrlRaw =
                                                    typeof u.avatar_url === "string" && u.avatar_url.trim()
                                                        ? u.avatar_url.trim()
                                                        : null;

                                                const avatarSrc = resolveAvatarSrc(avatarUrlRaw);

                                                const r = normalizeRole(u.role ?? "");
                                                const roleLabelText = r.includes("student")
                                                    ? "Student"
                                                    : r.includes("guest")
                                                        ? "Guest"
                                                        : (u.role || "User");

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
                                                                <AvatarFallback className="text-[0.7rem] font-semibold">
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <div className="font-medium text-foreground">
                                                                {u.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                ID: {String(u.id)}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {u.email}
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge variant="secondary" className="text-[0.70rem]">
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
                                                                    {(u.year_level || u.course) ? (
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
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default CounselorUsers;
