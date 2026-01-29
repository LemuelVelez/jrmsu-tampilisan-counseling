/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Loader2,
    RefreshCcw,
    Users,
    Shield,
    GraduationCap,
    HeartHandshake,
    UserCog,
    UserCheck,
    MessageCircle,
    BarChart3,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { AUTH_API_BASE_URL, type AuthenticatedUserDto } from "@/api/auth/route";
import { normalizeRole } from "@/lib/role";

import { fetchAdminMessageConversations } from "@/lib/messages";
import { getAdminAnalyticsApi } from "@/api/admin-analytics/route";
import type { MonthlyCountRow } from "@/api/analytics/route";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
} from "recharts";

type AdminUser = AuthenticatedUserDto & {
    role?: string | null;
    avatar_url?: string | null;
    created_at?: string | null;
};

type RolesResponse =
    | string[]
    | { roles?: string[]; data?: string[];[k: string]: unknown };

type UsersResponse =
    | AdminUser[]
    | { users?: AdminUser[]; data?: AdminUser[];[k: string]: unknown };

// ✅ include referral_user in fallback roles
const FALLBACK_ROLES = ["admin", "counselor", "student", "referral_user", "guest"] as const;

const PIE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#64748b"];
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

        const err = new Error(message) as any;
        err.status = response.status;
        err.data = body ?? text;
        throw err;
    }

    return data as T;
}

function extractRoles(payload: RolesResponse): string[] {
    if (Array.isArray(payload)) return payload.filter(Boolean).map(String);
    const obj = payload as any;
    const roles = obj?.roles ?? obj?.data;
    if (Array.isArray(roles)) return roles.filter(Boolean).map(String);
    return [];
}

function extractUsers(payload: UsersResponse): AdminUser[] {
    if (Array.isArray(payload)) return payload as AdminUser[];
    const obj = payload as any;
    const users = obj?.users ?? obj?.data;
    if (Array.isArray(users)) return users as AdminUser[];
    return [];
}

// ✅ Treat dean/registrar/program chair as referral_user (one bucket)
function isReferralRole(roleRaw: string): boolean {
    const r = normalizeRole(roleRaw);
    return (
        r.includes("referral") ||
        r.includes("dean") ||
        r.includes("registrar") ||
        r.includes("program_chair") ||
        r.includes("program chair") ||
        r.includes("programchair")
    );
}

function niceRoleLabel(roleRaw: string): string {
    const r = normalizeRole(roleRaw);
    if (!r) return "Unknown";
    if (r.includes("admin")) return "Admin";
    if (r.includes("counselor") || r.includes("counsellor")) return "Counselor";
    if (r.includes("student")) return "Student";
    if (isReferralRole(roleRaw)) return "Referral user";
    if (r.includes("guest")) return "Guest";
    return roleRaw.trim() ? roleRaw.trim() : "Other";
}

function safeUserName(u: AdminUser): string {
    const name = String(u.name ?? "").trim();
    if (name) return name;
    const email = String(u.email ?? "").trim();
    return email || `User #${String(u.id)}`;
}

function safeCreatedAtTs(u: AdminUser): number {
    const t = Date.parse(String(u.created_at ?? ""));
    return Number.isFinite(t) ? t : 0;
}

// =====================
// Messages overview utils
// =====================
type PeerRole = "student" | "guest" | "counselor" | "admin" | "referral_user";

type MessageThreadRow = {
    id: string;
    peerName: string;
    peerRole: PeerRole;
    lastMessage: string;
    lastTimestampIso: string;
};

type MessagesOverview = {
    totalThreads: number;
    threadsLast7Days: number;
    lastActivityLabel: string;
    roleBreakdown: { name: string; value: number }[];
    latestThreads: MessageThreadRow[];
};

function toPeerRole(raw: any): PeerRole | null {
    if (raw == null) return null;
    const r0 = String(raw).trim();
    const r = r0.toLowerCase();

    if (r === "student" || r === "students") return "student";
    if (r === "guest" || r === "guests") return "guest";
    if (r === "counselor" || r === "counsellor" || r === "counselors") return "counselor";
    if (r === "admin" || r === "admins") return "admin";

    if (
        r === "referral_user" ||
        r === "referral user" ||
        r === "referral-user" ||
        r === "referral_users" ||
        r === "referral-users" ||
        r === "referralusers"
    )
        return "referral_user";

    // office roles
    if (r === "dean" || r === "registrar" || r === "program_chair" || r === "program chair" || r === "programchair") return "referral_user";

    return null;
}

function roleLabel(r: PeerRole): string {
    if (r === "counselor") return "Counselor";
    if (r === "guest") return "Guest";
    if (r === "admin") return "Admin";
    if (r === "referral_user") return "Referral user";
    return "Student";
}

function extractArrayFromPayload(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    const candidates = [
        payload.conversations,
        payload.data,
        payload.items,
        payload.results,
        payload.records,
        payload?.payload?.conversations,
        payload?.payload?.data,
    ];
    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
}

function safeSnippet(s: any, maxLen = 84): string {
    const t = String(s ?? "").replace(/\s+/g, " ").trim();
    if (!t) return "—";
    return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

function bestIsoFromAny(v: any): string {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return "";
    return new Date(t).toISOString();
}

function conversationRoleFromId(conversationId: string): PeerRole {
    const id = String(conversationId ?? "").trim().toLowerCase();
    if (!id) return "student";

    const m = id.match(/^(student|guest|admin|referral_user)-\d+/i);
    if (m && toPeerRole(m[1])) return toPeerRole(m[1]) as PeerRole;

    if (id.startsWith("counselor-")) return "counselor";
    if (id.startsWith("referral_user-")) return "referral_user";
    return "student";
}

function pickPeerNameFromThread(thread: any, role: PeerRole): string {
    const last = thread?.last_message ?? thread?.lastMessage ?? thread?.last ?? null;

    const candidates = [
        last?.owner_name,
        last?.recipient_name,
        last?.sender_name,
        thread?.peer_name,
        thread?.peerName,
        thread?.owner_name,
        thread?.recipient_name,
        thread?.sender_name,
    ];

    for (const c of candidates) {
        const s = typeof c === "string" ? c.trim() : "";
        if (s) return s;
    }

    return roleLabel(role);
}

function pickLastContent(thread: any): string {
    const last = thread?.last_message ?? thread?.lastMessage ?? thread?.last ?? null;
    return (
        (typeof last?.content === "string" ? last.content : "") ||
        (typeof thread?.last_message_text === "string" ? thread.last_message_text : "") ||
        (typeof thread?.lastMessage === "string" ? thread.lastMessage : "") ||
        ""
    );
}

function pickLastTimestampIso(thread: any): string {
    const last = thread?.last_message ?? thread?.lastMessage ?? thread?.last ?? null;

    const candidates = [
        last?.created_at,
        last?.createdAt,
        thread?.last_timestamp,
        thread?.lastTimestamp,
        thread?.updated_at,
        thread?.updatedAt,
        thread?.created_at,
        thread?.createdAt,
    ];

    for (const c of candidates) {
        const iso = bestIsoFromAny(c);
        if (iso) return iso;
    }

    return "";
}

// =====================
// Analytics overview utils
// =====================
function safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function monthLabel(year: number, month: number) {
    const d = new Date(year, Math.max(0, month - 1), 1);
    return format(d, "MMM yyyy");
}

type ChartTheme = {
    chart1: string;
    border: string;
    mutedForeground: string;
    card: string;
};

function getCssVar(name: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function readChartTheme(): ChartTheme {
    return {
        chart1: getCssVar("--chart-1", "oklch(0.646 0.222 41.116)"),
        border: getCssVar("--border", "oklch(0.922 0 0)"),
        mutedForeground: getCssVar("--muted-foreground", "oklch(0.556 0 0)"),
        card: getCssVar("--card", "oklch(1 0 0)"),
    };
}

type AnalyticsOverview = {
    thisMonth: number;
    thisSemester: number;
    totalInRange: number;
    rangeText: string;
    chartData: { name: string; count: number; year: number; month: number }[];
};

const AdminOverview: React.FC = () => {
    const [roles, setRoles] = React.useState<string[]>([]);
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [lastUpdated, setLastUpdated] = React.useState<string>("");
    const [snapshotNowTs, setSnapshotNowTs] = React.useState<number>(0);

    // messages overview
    const [messagesLoading, setMessagesLoading] = React.useState<boolean>(true);
    const [messagesError, setMessagesError] = React.useState<string | null>(null);
    const [messagesOverview, setMessagesOverview] = React.useState<MessagesOverview>(() => ({
        totalThreads: 0,
        threadsLast7Days: 0,
        lastActivityLabel: "",
        roleBreakdown: [],
        latestThreads: [],
    }));

    // analytics overview
    const [analyticsLoading, setAnalyticsLoading] = React.useState<boolean>(true);
    const [analyticsError, setAnalyticsError] = React.useState<string | null>(null);
    const [analyticsOverview, setAnalyticsOverview] = React.useState<AnalyticsOverview>(() => ({
        thisMonth: 0,
        thisSemester: 0,
        totalInRange: 0,
        rangeText: "",
        chartData: [],
    }));

    // chart theme (analytics mini chart)
    const [theme, setTheme] = React.useState<ChartTheme>(() => readChartTheme());

    React.useEffect(() => {
        setTheme(readChartTheme());
        const obs = new MutationObserver(() => setTheme(readChartTheme()));
        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"],
        });
        return () => obs.disconnect();
    }, []);

    const fetchUsersAndRoles = React.useCallback(async () => {
        const [rolesRes, usersRes] = await Promise.all([
            apiFetch<RolesResponse>("/admin/roles", { method: "GET" }),
            apiFetch<UsersResponse>("/admin/users", { method: "GET" }),
        ]);

        return {
            roles: extractRoles(rolesRes),
            users: extractUsers(usersRes),
        };
    }, []);

    const fetchMessagesOverview = React.useCallback(async (): Promise<MessagesOverview> => {
        const nowTs = Date.now();
        const cutoff = nowTs - 7 * DAY_MS;

        const res = await fetchAdminMessageConversations({
            page: 1,
            per_page: 200,
        });

        const raw = extractArrayFromPayload(res);
        const rows: MessageThreadRow[] = raw
            .map((t: any) => {
                const conversationId = String(t?.conversation_id ?? t?.id ?? t?.conversationId ?? "").trim();
                if (!conversationId) return null;

                const role =
                    conversationRoleFromId(conversationId) ??
                    toPeerRole(t?.peer_role ?? t?.owner_role ?? t?.role) ??
                    "student";

                const lastIso = pickLastTimestampIso(t);
                const lastTs = lastIso ? Date.parse(lastIso) : 0;

                return {
                    id: conversationId,
                    peerRole: role,
                    peerName: pickPeerNameFromThread(t, role),
                    lastMessage: pickLastContent(t),
                    lastTimestampIso: lastIso || (lastTs ? new Date(lastTs).toISOString() : ""),
                } as MessageThreadRow;
            })
            .filter(Boolean) as MessageThreadRow[];

        const totalThreads = rows.length;

        const threadsLast7Days = rows.filter((r) => {
            const ts = r.lastTimestampIso ? Date.parse(r.lastTimestampIso) : 0;
            return Number.isFinite(ts) && ts >= cutoff;
        }).length;

        const sorted = [...rows].sort((a, b) => {
            const ta = a.lastTimestampIso ? Date.parse(a.lastTimestampIso) : 0;
            const tb = b.lastTimestampIso ? Date.parse(b.lastTimestampIso) : 0;
            return tb - ta;
        });

        const latestThreads = sorted.slice(0, 6);

        const lastActivityIso = sorted[0]?.lastTimestampIso ?? "";
        const lastActivityLabel = lastActivityIso
            ? format(new Date(lastActivityIso), "MMM d, yyyy – h:mm a")
            : "";

        const counts = new Map<string, number>();
        for (const r of rows) {
            const label = roleLabel(r.peerRole);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }

        const roleBreakdown = Array.from(counts.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return {
            totalThreads,
            threadsLast7Days,
            lastActivityLabel,
            roleBreakdown,
            latestThreads,
        };
    }, []);

    const fetchAnalyticsOverview = React.useCallback(async (): Promise<AnalyticsOverview> => {
        const today = new Date();
        const endDate = format(today, "yyyy-MM-dd");
        const startDate = format(new Date(today.getFullYear(), today.getMonth() - 5, 1), "yyyy-MM-dd");

        const res: any = await getAdminAnalyticsApi({
            start_date: startDate,
            end_date: endDate,
        });

        const thisMonth = safeNumber(res?.this_month_count);
        const thisSemester = safeNumber(res?.this_semester_count);

        const monthly: MonthlyCountRow[] = Array.isArray(res?.monthly_counts) ? res.monthly_counts : [];
        const totalInRange = (monthly ?? []).reduce((acc, r) => acc + safeNumber((r as any)?.count), 0);

        const sorted = [...(monthly ?? [])].sort((a: any, b: any) => {
            const da = safeNumber(a.year) * 100 + safeNumber(a.month);
            const db = safeNumber(b.year) * 100 + safeNumber(b.month);
            return da - db;
        });

        const chartData = sorted.map((r: any) => ({
            name: monthLabel(safeNumber(r.year), safeNumber(r.month)),
            count: safeNumber(r.count),
            year: safeNumber(r.year),
            month: safeNumber(r.month),
        }));

        const rs = res?.range?.start_date ?? startDate;
        const re = res?.range?.end_date ?? endDate;
        const rangeText = rs && re ? `${rs} to ${re}` : "";

        return {
            thisMonth,
            thisSemester,
            totalInRange,
            rangeText,
            chartData,
        };
    }, []);

    const reload = React.useCallback(
        async (mode: "initial" | "refresh" = "refresh") => {
            if (mode === "initial") setIsLoading(true);
            else setIsRefreshing(true);

            setMessagesLoading(true);
            setAnalyticsLoading(true);
            setMessagesError(null);
            setAnalyticsError(null);

            try {
                const results = await Promise.allSettled([
                    fetchUsersAndRoles(),
                    fetchMessagesOverview(),
                    fetchAnalyticsOverview(),
                ]);

                const usersRoles = results[0];
                if (usersRoles.status === "fulfilled") {
                    setRoles(usersRoles.value.roles);
                    setUsers(usersRoles.value.users);
                } else {
                    setRoles([]);
                    setUsers([]);
                    toast.error(usersRoles.reason instanceof Error ? usersRoles.reason.message : "Failed to load users/roles.");
                }

                const msgs = results[1];
                if (msgs.status === "fulfilled") {
                    setMessagesOverview(msgs.value);
                } else {
                    const msg = msgs.reason instanceof Error ? msgs.reason.message : "Failed to load messages overview.";
                    setMessagesError(msg);
                }

                const an = results[2];
                if (an.status === "fulfilled") {
                    setAnalyticsOverview(an.value);
                } else {
                    const msg = an.reason instanceof Error ? an.reason.message : "Failed to load analytics overview.";
                    setAnalyticsError(msg);
                }

                const nowTs = Date.now();
                setSnapshotNowTs(nowTs);
                setLastUpdated(format(new Date(nowTs), "MMM d, yyyy – h:mm a"));

                if (mode !== "initial") toast.success("Overview refreshed.");
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to load admin overview.";
                toast.error(msg);
            } finally {
                setMessagesLoading(false);
                setAnalyticsLoading(false);

                if (mode === "initial") setIsLoading(false);
                else setIsRefreshing(false);
            }
        },
        [fetchUsersAndRoles, fetchMessagesOverview, fetchAnalyticsOverview],
    );

    React.useEffect(() => {
        void reload("initial");
    }, [reload]);

    const effectiveRoles = React.useMemo(() => {
        const clean = roles.map((r) => String(r).trim()).filter(Boolean);
        const base = clean.length > 0 ? clean : [...FALLBACK_ROLES];

        const seen = new Set<string>();
        const uniq: string[] = [];

        for (const r of base) {
            const key = normalizeRole(r);
            if (!seen.has(key)) {
                seen.add(key);
                uniq.push(r);
            }
        }
        return uniq;
    }, [roles]);

    const stats = React.useMemo(() => {
        const total = users.length;

        let admins = 0;
        let counselors = 0;
        let students = 0;
        let referrals = 0;
        let guests = 0;
        let unknown = 0;

        const counts = new Map<string, number>();

        for (const u of users) {
            const raw = String(u.role ?? "");
            const norm = normalizeRole(raw);

            if (!norm) unknown += 1;
            else if (norm.includes("admin")) admins += 1;
            else if (norm.includes("counselor") || norm.includes("counsellor")) counselors += 1;
            else if (norm.includes("student")) students += 1;
            else if (isReferralRole(raw)) referrals += 1;
            else if (norm.includes("guest")) guests += 1;
            else unknown += 1;

            const label = niceRoleLabel(raw);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }

        const roleData = Array.from(counts.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const topRoles = roleData.slice(0, 6);

        const cutoff = snapshotNowTs > 0 ? snapshotNowTs - 7 * DAY_MS : 0;
        const newLast7 = cutoff > 0 ? users.filter((u) => safeCreatedAtTs(u) >= cutoff).length : 0;

        const recentUsers = [...users]
            .sort((a, b) => safeCreatedAtTs(b) - safeCreatedAtTs(a))
            .slice(0, 8)
            .map((u) => ({
                id: u.id,
                name: safeUserName(u),
                email: String(u.email ?? ""),
                role: niceRoleLabel(String(u.role ?? "")),
                created_at: u.created_at ? String(u.created_at) : "",
            }));

        return {
            total,
            admins,
            counselors,
            students,
            referrals,
            guests,
            unknown,
            topRoles,
            roleData,
            newLast7,
            recentUsers,
        };
    }, [users, snapshotNowTs]);

    const messagesRoleTop = React.useMemo(() => {
        return (messagesOverview.roleBreakdown ?? []).slice(0, 6);
    }, [messagesOverview.roleBreakdown]);

    const analyticsMini = React.useMemo(() => {
        // Show at most last 6 points (already last 6 months range, but keep safe)
        const data = analyticsOverview.chartData ?? [];
        return data.slice(Math.max(0, data.length - 6));
    }, [analyticsOverview.chartData]);

    return (
        <DashboardLayout title="Overview" description="Admin dashboard overview for User Management.">
            <div className="mx-auto w-full space-y-4 px-4">
                <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-xs text-amber-900">
                        <p className="font-semibold">Admin Overview</p>
                        <p className="text-[0.7rem] text-amber-900/80">
                            Quick snapshot of users, messages, and analytics.
                            {lastUpdated ? <span className="ml-2">Last updated: {lastUpdated}</span> : null}
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        <Button asChild size="sm" className="w-full gap-2 sm:w-auto" disabled={isLoading}>
                            <Link to="/dashboard/admin/users">
                                <Users className="h-4 w-4" />
                                Manage users
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline" className="w-full gap-2 sm:w-auto" disabled={isLoading}>
                            <Link to="/dashboard/admin/message">
                                <MessageCircle className="h-4 w-4" />
                                Messages
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline" className="w-full gap-2 sm:w-auto" disabled={isLoading}>
                            <Link to="/dashboard/admin/analytics">
                                <BarChart3 className="h-4 w-4" />
                                Analytics
                            </Link>
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void reload("refresh")}
                            disabled={isRefreshing || isLoading}
                            className="w-full gap-2 sm:w-auto"
                        >
                            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <Users className="h-4 w-4 text-amber-600" />
                                Total users
                            </CardTitle>
                            <CardDescription className="text-xs">All accounts</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.total}
                            <div className="mt-1 text-[0.7rem] font-normal text-muted-foreground">
                                New (last 7 days):{" "}
                                <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.newLast7}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <Shield className="h-4 w-4 text-amber-600" />
                                Admins
                            </CardTitle>
                            <CardDescription className="text-xs">System access</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">{isLoading ? "—" : stats.admins}</CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <HeartHandshake className="h-4 w-4 text-amber-600" />
                                Counselors
                            </CardTitle>
                            <CardDescription className="text-xs">Support staff</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">{isLoading ? "—" : stats.counselors}</CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <GraduationCap className="h-4 w-4 text-amber-600" />
                                Students
                            </CardTitle>
                            <CardDescription className="text-xs">Learners</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">{isLoading ? "—" : stats.students}</CardContent>
                    </Card>

                    {/* ✅ Referral users card */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <UserCheck className="h-4 w-4 text-amber-600" />
                                Referral users
                            </CardTitle>
                            <CardDescription className="text-xs">Dean / Registrar / Program Chair</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">{isLoading ? "—" : stats.referrals}</CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <UserCog className="h-4 w-4 text-amber-600" />
                                Guests / Other
                            </CardTitle>
                            <CardDescription className="text-xs">Non-student accounts</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.guests + stats.unknown}
                            <div className="mt-1 text-[0.7rem] font-normal text-muted-foreground">
                                Guests:{" "}
                                <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.guests}</span>
                                {" • "}
                                Unknown:{" "}
                                <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.unknown}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ✅ Messages + Analytics overview */}
                <div className="grid gap-3 lg:grid-cols-2">
                    {/* Messages overview */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                        <MessageCircle className="h-4 w-4 text-amber-600" />
                                        Messages overview
                                    </CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Snapshot of admin inbox threads.
                                    </CardDescription>
                                </div>

                                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto" disabled={messagesLoading}>
                                    <Link to="/dashboard/admin/message">Open messages</Link>
                                </Button>
                            </div>

                            <Separator />

                            {messagesError ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                                    {messagesError}
                                </div>
                            ) : null}

                            <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">Total threads</div>
                                    <div className="mt-1 text-xl font-bold text-amber-900">
                                        {messagesLoading ? "—" : messagesOverview.totalThreads}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">Active (last 7 days)</div>
                                    <div className="mt-1 text-xl font-bold text-amber-900">
                                        {messagesLoading ? "—" : messagesOverview.threadsLast7Days}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">Last activity</div>
                                    <div className="mt-1 text-sm font-semibold text-amber-900">
                                        {messagesLoading ? "—" : (messagesOverview.lastActivityLabel || "—")}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {messagesLoading ? (
                                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading messages overview...
                                </div>
                            ) : messagesOverview.totalThreads === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                    No threads found yet.
                                </div>
                            ) : (
                                <>
                                    {/* Role breakdown (threads) */}
                                    <div className="rounded-md border bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Thread role</TableHead>
                                                    <TableHead className="w-24 text-right">Count</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {messagesRoleTop.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={2} className="text-center text-xs text-muted-foreground">
                                                            No breakdown available.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    messagesRoleTop.map((r) => (
                                                        <TableRow key={r.name}>
                                                            <TableCell className="text-sm">{r.name}</TableCell>
                                                            <TableCell className="text-right text-sm font-semibold">{r.value}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <Separator />

                                    {/* Latest threads */}
                                    <div>
                                        <div className="mb-2 text-xs font-semibold text-amber-900">Latest threads</div>
                                        <div className="overflow-auto rounded-md border bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>User</TableHead>
                                                        <TableHead className="w-32">Role</TableHead>
                                                        <TableHead>Last message</TableHead>
                                                        <TableHead className="w-44">Time</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {messagesOverview.latestThreads.map((t) => (
                                                        <TableRow key={t.id}>
                                                            <TableCell className="text-sm">
                                                                <div className="font-medium text-foreground">{t.peerName}</div>
                                                                <div className="text-[0.7rem] text-muted-foreground">Thread: {t.id}</div>
                                                            </TableCell>
                                                            <TableCell className="text-sm">{roleLabel(t.peerRole)}</TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">{safeSnippet(t.lastMessage)}</TableCell>
                                                            <TableCell className="text-sm">
                                                                {t.lastTimestampIso ? format(new Date(t.lastTimestampIso), "MMM d, yyyy • h:mm a") : "—"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Analytics overview */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                        <BarChart3 className="h-4 w-4 text-amber-600" />
                                        Analytics overview
                                    </CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Quick metrics + monthly trend (last ~6 months).
                                    </CardDescription>
                                </div>

                                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto" disabled={analyticsLoading}>
                                    <Link to="/dashboard/admin/analytics">Open analytics</Link>
                                </Button>
                            </div>

                            <Separator />

                            {analyticsError ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                                    {analyticsError}
                                </div>
                            ) : null}

                            {analyticsOverview.rangeText ? (
                                <div className="text-[0.7rem] text-muted-foreground">
                                    Range: <span className="font-medium text-foreground">{analyticsOverview.rangeText}</span>
                                </div>
                            ) : null}

                            <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">This month</div>
                                    <div className="mt-1 text-xl font-bold text-amber-900">
                                        {analyticsLoading ? "—" : analyticsOverview.thisMonth}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">This semester</div>
                                    <div className="mt-1 text-xl font-bold text-amber-900">
                                        {analyticsLoading ? "—" : analyticsOverview.thisSemester}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                                    <div className="text-[0.7rem] text-muted-foreground">Total in range</div>
                                    <div className="mt-1 text-xl font-bold text-amber-900">
                                        {analyticsLoading ? "—" : analyticsOverview.totalInRange}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {analyticsLoading ? (
                                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading analytics overview...
                                </div>
                            ) : analyticsMini.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-10 text-center text-xs text-muted-foreground">
                                    No analytics data for the selected range.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analyticsMini} margin={{ top: 10, right: 18, bottom: 10, left: 0 }}>
                                            <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="name"
                                                tickMargin={10}
                                                tick={{ fill: theme.mutedForeground, fontSize: 11 }}
                                                axisLine={{ stroke: theme.border }}
                                                tickLine={{ stroke: theme.border }}
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                width={40}
                                                tick={{ fill: theme.mutedForeground, fontSize: 11 }}
                                                axisLine={{ stroke: theme.border }}
                                                tickLine={{ stroke: theme.border }}
                                            />
                                            <Tooltip />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                stroke={theme.chart1}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: theme.chart1, stroke: theme.card, strokeWidth: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Roles + charts */}
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-sm font-semibold text-amber-900">Role distribution</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Based on current users table (admin/users).
                            </CardDescription>
                            <Separator />
                            <div className="text-xs text-muted-foreground">
                                Available roles:{" "}
                                <span className="font-medium text-foreground">
                                    {effectiveRoles.length ? effectiveRoles.join(", ") : "—"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading overview...
                                </div>
                            ) : stats.roleData.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                    No users to summarize yet.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.roleData}
                                                dataKey="value"
                                                nameKey="name"
                                                outerRadius={90}
                                                innerRadius={50}
                                                paddingAngle={2}
                                            >
                                                {stats.roleData.map((_, idx) => (
                                                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Top roles</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Highest user counts by role label.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading chart...
                                </div>
                            ) : stats.topRoles.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                    No role data.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.topRoles} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent users */}
                <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-amber-900">Recently added users</CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Latest accounts (sorted by created_at when available).
                                </CardDescription>
                            </div>

                            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
                                <Link to="/dashboard/admin/users">Open user list</Link>
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading users...
                            </div>
                        ) : stats.recentUsers.length === 0 ? (
                            <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                No users found.
                            </div>
                        ) : (
                            <div className="overflow-auto rounded-md border bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="w-40">Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.recentUsers.map((u) => (
                                            <TableRow key={String(u.id)}>
                                                <TableCell className="text-xs text-muted-foreground">{String(u.id)}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-foreground">{u.name}</div>
                                                    {u.created_at ? (
                                                        <div className="text-[0.7rem] text-muted-foreground">Created: {u.created_at}</div>
                                                    ) : (
                                                        <div className="text-[0.7rem] text-muted-foreground">Created: —</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                                                <TableCell className="text-sm">{u.role}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AdminOverview;
