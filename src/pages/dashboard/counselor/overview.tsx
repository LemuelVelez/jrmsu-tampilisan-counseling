/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
    AlertCircle,
    CalendarClock,
    ClipboardList as ClipboardListIcon,
    Loader2,
    MessageCircle,
    RefreshCw,
    Share2,
    Users as UsersIcon,
} from "lucide-react";

import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";
import type { IntakeAssessmentDto, MentalFrequencyApi, IntakeRequestDto } from "@/api/intake/route";
import { fetchCounselorMessages, type CounselorMessage } from "@/lib/messages";
import { fetchCounselorReferrals, type Referral } from "@/lib/referrals";
import { getCurrentSession } from "@/lib/authentication";
import { normalizeRole } from "@/lib/role";

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

// ===== Intake helpers (PHQ-style) =====
const FREQUENCY_SCORES: Record<MentalFrequencyApi, number> = {
    not_at_all: 0,
    several_days: 1,
    more_than_half: 2,
    nearly_every_day: 3,
};

const MH_KEYS: (keyof IntakeAssessmentDto)[] = [
    "mh_little_interest",
    "mh_feeling_down",
    "mh_sleep",
    "mh_energy",
    "mh_appetite",
    "mh_self_esteem",
    "mh_concentration",
    "mh_motor",
    "mh_self_harm",
];

function calculatePhqScore(assessment: IntakeAssessmentDto): { score: number; answered: number } {
    let score = 0;
    let answered = 0;

    for (const key of MH_KEYS) {
        const value = assessment[key] as MentalFrequencyApi | null | undefined;
        if (!value) continue;
        if (value in FREQUENCY_SCORES) {
            score += FREQUENCY_SCORES[value];
            answered += 1;
        }
    }

    return { score, answered };
}

function phqSeverityLabel(score: number): string {
    if (score <= 4) return "Minimal";
    if (score <= 9) return "Mild";
    if (score <= 14) return "Moderate";
    if (score <= 19) return "Moderately severe";
    return "Severe";
}

// ===== shared helpers =====
function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorApiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
    const url = resolveApiUrl(path);

    // ✅ Use shared header builder so Bearer token from storage is auto-attached
    // and still allow explicit override via `token`.
    const mergedHeaders: HeadersInit = {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(mergedHeaders),
        credentials: "include",
    });

    const text = await res.text();
    let data: unknown = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        const body = data as any;
        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object" ? (Object.values(body.errors)[0] as any)?.[0] : undefined;

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            res.statusText ||
            "An unknown error occurred while communicating with the server.";

        const err = new Error(message) as Error & { status?: number; data?: unknown };
        err.status = res.status;
        err.data = body ?? text;
        throw err;
    }

    return data as T;
}

function formatDateTime(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy – h:mm a");
    } catch {
        return dateString;
    }
}

function niceLabel(s: string): string {
    const v = String(s ?? "").trim().toLowerCase();
    if (!v) return "—";
    return v
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
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

function getStudentDisplayNameFromDirectory(record: any, nameById?: Map<string, string>): string {
    const candidate =
        record?.student_name ??
        record?.student_full_name ??
        record?.full_name ??
        record?.name ??
        record?.user_name ??
        record?.user?.name ??
        record?.student?.name;

    const id = record?.user_id ?? record?.student_id ?? record?.user?.id ?? record?.student?.id;

    if (candidate && typeof candidate === "string") return candidate;

    if (nameById && id !== undefined && id !== null) {
        const found = nameById.get(String(id));
        if (found) return found;
    }

    if (id !== undefined && id !== null) return `Student #${String(id)}`;
    return "Unknown student";
}

function getReferralRequestedByLabel(r: any): string {
    const roleRaw =
        r?.requested_by_role ??
        r?.requestedBy?.role ??
        r?.requested_by?.role ??
        r?.requestedBy?.user_role ??
        r?.requested_by?.user_role ??
        "referral_user";

    const nameRaw =
        r?.requested_by_name ??
        r?.requestedBy?.name ??
        r?.requested_by?.name ??
        r?.requestedBy?.email ??
        r?.requested_by?.email ??
        "";

    const roleLabel = niceLabel(String(roleRaw));
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

    if (name) return `${name} (${roleLabel})`;
    return roleLabel || "Referral User";
}

// ===== fetchers (robust) =====
async function fetchAssessments(token?: string | null): Promise<IntakeAssessmentDto[]> {
    const tryPaths = [
        "/counselor/intake/assessments",
        "/counselor/assessments",
        "/counselor/intake-assessments",
    ];

    let lastErr: any = null;

    for (const path of tryPaths) {
        try {
            const raw = await counselorApiFetch<any>(path, { method: "GET" }, token);

            const list =
                Array.isArray(raw) && raw.length && typeof raw[0] === "object"
                    ? raw
                    : Array.isArray(raw?.assessments)
                        ? raw.assessments
                        : Array.isArray(raw?.data)
                            ? raw.data
                            : [];

            return list as IntakeAssessmentDto[];
        } catch (e: any) {
            lastErr = e;
            const status = Number(e?.status);
            if (status === 404 || status === 405) continue;
        }
    }

    if (lastErr) throw lastErr;
    return [];
}

async function fetchRequests(token?: string | null): Promise<IntakeRequestDto[]> {
    const tryPaths = [
        "/counselor/intake/requests",
        "/counselor/appointments", // pagination: {data: [...]}
        "/counselor/intake-requests",
        "/counselor/appointment-requests",
    ];

    let lastErr: any = null;

    for (const path of tryPaths) {
        try {
            const raw = await counselorApiFetch<any>(path, { method: "GET" }, token);

            const list =
                Array.isArray(raw) && raw.length && typeof raw[0] === "object"
                    ? raw
                    : Array.isArray(raw?.requests)
                        ? raw.requests
                        : Array.isArray(raw?.intakes)
                            ? raw.intakes
                            : Array.isArray(raw?.appointments)
                                ? raw.appointments
                                : Array.isArray(raw?.data)
                                    ? raw.data
                                    : [];

            return list as IntakeRequestDto[];
        } catch (e: any) {
            lastErr = e;
            const status = Number(e?.status);
            if (status === 404 || status === 405) continue;
        }
    }

    if (lastErr) throw lastErr;
    return [];
}

type DirectoryUser = {
    id: string | number;
    name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
    created_at?: string | null;
};

function mapToDirectoryUser(raw: any): DirectoryUser | null {
    const u = raw?.user ?? raw;

    const id = u?.id ?? u?.user_id ?? u?.student_id ?? u?.guest_id;
    const email = typeof u?.email === "string" ? u.email.trim() : "";

    if (id == null || String(id).trim() === "") return null;
    if (!email) return null;

    const name = typeof u?.name === "string" && u.name.trim() ? u.name.trim() : email;
    const roleRaw =
        typeof u?.role === "string" && u.role.trim()
            ? u.role.trim()
            : typeof u?.user_role === "string"
                ? u.user_role.trim()
                : "";

    const avatar_url = typeof u?.avatar_url === "string" && u.avatar_url.trim() ? u.avatar_url.trim() : null;

    return {
        id,
        name,
        email,
        role: roleRaw || "user",
        avatar_url,
        created_at: typeof u?.created_at === "string" ? u.created_at : null,
    };
}

async function fetchCounselorStudentAndGuestUsers(token?: string | null): Promise<DirectoryUser[]> {
    const endpoints = [
        "/counselor/users?roles=student,guest",
        "/counselor/users?role=student",
        "/counselor/users?role=guest",
        "/counselor/students",
        "/counselor/guests",
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
        try {
            const data = await counselorApiFetch<any>(path, { method: "GET" }, token);
            const arr = extractUsersArray(data);

            const mapped = arr.map(mapToDirectoryUser).filter(Boolean) as DirectoryUser[];

            for (const u of mapped) {
                const key = String(u.id);
                if (seen.has(key)) continue;

                const r = normalizeRole(u.role ?? "");
                const looksValid = r.includes("student") || r.includes("guest");

                if (!looksValid && (path.includes("students") || path.includes("guests"))) {
                    // keep
                } else if (!looksValid) {
                    continue;
                }

                seen.add(key);
                merged.push(u);
            }
        } catch (e) {
            lastErr = e;
            // keep trying next endpoint
        }
    }

    if (merged.length === 0 && lastErr) throw lastErr;
    return merged;
}

// ===== Messages helpers =====
function isUnreadFlag(dto: CounselorMessage): boolean {
    return (dto as any)?.is_read === false || (dto as any)?.is_read === 0;
}

function safeConversationId(dto: CounselorMessage): string {
    const raw = (dto as any)?.conversation_id ?? (dto as any)?.conversationId ?? dto.conversation_id;
    if (raw != null && String(raw).trim()) return String(raw);

    const sender = String(dto.sender ?? "system");
    const userId = (dto as any)?.user_id ?? dto.user_id ?? "";
    return userId ? `${sender}-${userId}` : "general";
}

const PIE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#64748b"];
const DAY_MS = 24 * 60 * 60 * 1000;

const CounselorOverview: React.FC = () => {
    const session = getCurrentSession();
    const token = (session as any)?.token ?? null;

    const [assessments, setAssessments] = React.useState<IntakeAssessmentDto[]>([]);
    const [requests, setRequests] = React.useState<IntakeRequestDto[]>([]);
    const [messages, setMessages] = React.useState<CounselorMessage[]>([]);
    const [referrals, setReferrals] = React.useState<Referral[]>([]);
    const [users, setUsers] = React.useState<DirectoryUser[]>([]);

    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [lastUpdated, setLastUpdated] = React.useState<string>("");

    // ✅ stable snapshot for time-based derived calculations
    const [snapshotNowTs, setSnapshotNowTs] = React.useState<number>(0);

    const reload = React.useCallback(
        async (mode: "initial" | "refresh" = "refresh") => {
            if (mode === "initial") setIsLoading(true);
            else setIsRefreshing(true);

            setError(null);

            const settled = await Promise.allSettled([
                fetchAssessments(token),
                fetchRequests(token),
                fetchCounselorMessages().then((r) => (Array.isArray(r?.messages) ? r.messages : []) as CounselorMessage[]),
                fetchCounselorReferrals({ status: "all", per_page: 200 }),
                fetchCounselorStudentAndGuestUsers(token),
            ]);

            const [aRes, rRes, mRes, refRes, uRes] = settled;

            let anyOk = false;

            if (aRes.status === "fulfilled") {
                const sorted = [...aRes.value].sort(
                    (x, y) => (Date.parse(y.created_at ?? "") || 0) - (Date.parse(x.created_at ?? "") || 0),
                );
                setAssessments(sorted);
                anyOk = true;
            }

            if (rRes.status === "fulfilled") {
                const sorted = [...rRes.value].sort(
                    (x, y) => (Date.parse(y.created_at ?? "") || 0) - (Date.parse(x.created_at ?? "") || 0),
                );
                setRequests(sorted);
                anyOk = true;
            }

            if (mRes.status === "fulfilled") {
                const sorted = [...mRes.value].sort(
                    (x, y) => (Date.parse(y.created_at ?? "") || 0) - (Date.parse(x.created_at ?? "") || 0),
                );
                setMessages(sorted);
                anyOk = true;
            }

            if (refRes.status === "fulfilled") {
                const sorted = [...refRes.value].sort(
                    (x, y) => (Date.parse((y as any)?.created_at ?? "") || 0) - (Date.parse((x as any)?.created_at ?? "") || 0),
                );
                setReferrals(sorted);
                anyOk = true;
            }

            if (uRes.status === "fulfilled") {
                setUsers(uRes.value);
                anyOk = true;
            }

            if (!anyOk) {
                const msg =
                    (aRes.status === "rejected" && (aRes.reason?.message ?? String(aRes.reason))) ||
                    (rRes.status === "rejected" && (rRes.reason?.message ?? String(rRes.reason))) ||
                    (mRes.status === "rejected" && (mRes.reason?.message ?? String(mRes.reason))) ||
                    (refRes.status === "rejected" && (refRes.reason?.message ?? String(refRes.reason))) ||
                    (uRes.status === "rejected" && (uRes.reason?.message ?? String(uRes.reason))) ||
                    "Failed to load overview data.";

                setError(msg);
                toast.error(msg);
            }

            const nowTs = Date.now();
            setSnapshotNowTs(nowTs);
            setLastUpdated(format(new Date(nowTs), "MMM d, yyyy – h:mm a"));

            if (mode === "initial") setIsLoading(false);
            else setIsRefreshing(false);
        },
        [token],
    );

    React.useEffect(() => {
        void reload("initial");
    }, [reload]);

    const directoryNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const u of users) {
            const key = u?.id != null ? String(u.id) : "";
            const name = typeof u?.name === "string" ? u.name.trim() : "";
            if (key && name) map.set(key, name);
        }
        return map;
    }, [users]);

    // ===== Derived stats =====
    const intakeStats = React.useMemo(() => {
        const total = assessments.length;

        const scored = assessments.map((a) => ({ a, s: calculatePhqScore(a).score }));
        const avg = scored.length ? scored.reduce((sum, x) => sum + x.s, 0) / scored.length : 0;

        const severityCounts = new Map<string, number>();
        for (const { s } of scored) {
            const label = phqSeverityLabel(s);
            severityCounts.set(label, (severityCounts.get(label) ?? 0) + 1);
        }

        const severityData = ["Minimal", "Mild", "Moderate", "Moderately severe", "Severe"].map((name) => ({
            name,
            value: severityCounts.get(name) ?? 0,
        }));

        const now = snapshotNowTs > 0 ? snapshotNowTs : 0;
        const cutoff = now > 0 ? now - 7 * DAY_MS : 0;

        const last7 =
            cutoff > 0
                ? assessments.filter((x) => (Date.parse(x.created_at ?? "") || 0) >= cutoff).length
                : 0;

        const recent = assessments.slice(0, 5).map((x) => {
            const { score } = calculatePhqScore(x);
            return {
                id: x.id,
                student: getStudentDisplayNameFromDirectory(x, directoryNameById),
                submitted: formatDateTime(x.created_at),
                score,
                severity: phqSeverityLabel(score),
            };
        });

        return { total, avg, last7, severityData, recent };
    }, [assessments, snapshotNowTs, directoryNameById]);

    const apptStats = React.useMemo(() => {
        const total = requests.length;

        const byStatus = new Map<string, number>();
        const byUrgency = new Map<string, number>();

        let finalSet = 0;

        for (const r of requests) {
            const status = String((r as any)?.status ?? "pending").toLowerCase();
            const urgency = String((r as any)?.urgency ?? "").toLowerCase();

            byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
            if (urgency) byUrgency.set(urgency, (byUrgency.get(urgency) ?? 0) + 1);

            const hasFinal = Boolean((r as any)?.scheduled_date && (r as any)?.scheduled_time);
            if (hasFinal) finalSet += 1;
        }

        const statusData = ["pending", "scheduled", "completed", "cancelled"].map((k) => ({
            name: niceLabel(k),
            value: byStatus.get(k) ?? 0,
        }));

        const urgencyData = ["low", "medium", "high"].map((k) => ({
            name: niceLabel(k),
            value: byUrgency.get(k) ?? 0,
        }));

        const recent = requests.slice(0, 5).map((x) => ({
            id: x.id,
            student: getStudentDisplayNameFromDirectory(x, directoryNameById),
            requested: formatDateTime(x.created_at),
            status: niceLabel(String((x as any)?.status ?? "pending")),
            concern: niceLabel(String((x as any)?.concern_type ?? "")) || "—",
        }));

        const pending = byStatus.get("pending") ?? 0;
        const scheduled = byStatus.get("scheduled") ?? 0;

        return { total, pending, scheduled, finalSet, statusData, urgencyData, recent };
    }, [requests, directoryNameById]);

    const messageStats = React.useMemo(() => {
        const total = messages.length;
        const unread = messages.filter((m) => isUnreadFlag(m)).length;

        const conversations = new Set<string>();
        for (const m of messages) conversations.add(safeConversationId(m));

        const recent = messages.slice(0, 5).map((m) => ({
            id: m.id,
            sender: niceLabel(String(m.sender ?? "system")),
            content: String((m as any)?.content ?? "").slice(0, 80),
            created: formatDateTime(m.created_at),
            isUnread: isUnreadFlag(m),
        }));

        if (snapshotNowTs <= 0) {
            return { total, unread, conversationCount: conversations.size, timeline: [], recent };
        }

        // ✅ last 14 days timeline
        const days = 14;
        const base = new Date(snapshotNowTs);
        const buckets = new Map<string, number>();

        for (let i = 0; i < days; i += 1) {
            const d = new Date(base.getTime());
            d.setDate(base.getDate() - (days - 1 - i));
            const key = format(d, "yyyy-MM-dd");
            buckets.set(key, 0);
        }

        for (const m of messages) {
            const t = Date.parse(m.created_at ?? "");
            if (!Number.isFinite(t)) continue;
            const key = format(new Date(t), "yyyy-MM-dd");
            if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }

        const timeline = Array.from(buckets.entries()).map(([key, count]) => ({
            day: format(parseISO(key), "MMM d"),
            count,
        }));

        return { total, unread, conversationCount: conversations.size, timeline, recent };
    }, [messages, snapshotNowTs]);

    const referralStats = React.useMemo(() => {
        const total = referrals.length;

        const byStatus = new Map<string, number>();
        let pending = 0;

        const now = snapshotNowTs > 0 ? snapshotNowTs : 0;
        const cutoff = now > 0 ? now - 7 * DAY_MS : 0;

        let last7 = 0;

        for (const r of referrals) {
            const status = String((r as any)?.status ?? "pending").toLowerCase();
            byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
            if (status === "pending") pending += 1;

            if (cutoff > 0) {
                const t = Date.parse(String((r as any)?.created_at ?? ""));
                if (Number.isFinite(t) && t >= cutoff) last7 += 1;
            }
        }

        const statusKeys = ["pending", "handled", "closed"];
        const statusData = statusKeys.map((k) => ({
            name: niceLabel(k),
            value: byStatus.get(k) ?? 0,
        }));

        const recent = referrals.slice(0, 5).map((r) => ({
            id: (r as any)?.id,
            student: getStudentDisplayNameFromDirectory(r, directoryNameById),
            created: formatDateTime((r as any)?.created_at ?? null),
            status: niceLabel(String((r as any)?.status ?? "pending")),
            urgency: niceLabel(String((r as any)?.urgency ?? "")) || "—",
            requestedBy: getReferralRequestedByLabel(r),
        }));

        return { total, pending, last7, statusData, recent };
    }, [referrals, snapshotNowTs, directoryNameById]);

    const userStats = React.useMemo(() => {
        const total = users.length;
        let students = 0;
        let guests = 0;

        for (const u of users) {
            const r = normalizeRole(u.role ?? "");
            if (r.includes("student")) students += 1;
            else if (r.includes("guest")) guests += 1;
        }

        const roleData = [
            { name: "Students", value: students },
            { name: "Guests", value: guests },
        ];

        const recent = [...users]
            .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0))
            .slice(0, 5)
            .map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: normalizeRole(u.role ?? "").includes("student") ? "Student" : "Guest",
            }));

        return { total, students, guests, roleData, recent };
    }, [users]);

    return (
        <DashboardLayout
            title="Overview"
            description="At-a-glance summary of Intake, Appointments, Messages, Referrals, and Users."
        >
            <div className="mx-auto w-full px-4 space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-xs text-amber-900">
                        <p className="font-semibold">Guidance &amp; Counseling – Overview</p>
                        <p className="text-[0.7rem] text-amber-900/80">
                            Snapshot of activity across intake submissions, appointment requests, inbox messages, referrals, and user directory.
                            {lastUpdated ? <span className="ml-2">Last updated: {lastUpdated}</span> : null}
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void reload("refresh")}
                            disabled={isLoading || isRefreshing}
                            className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50 sm:w-auto"
                        >
                            {isLoading || isRefreshing ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Refreshing…
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    Refresh
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {error ? (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-800">
                        <AlertCircle className="mt-px h-3.5 w-3.5" />
                        <div>
                            <p className="font-medium">Some overview data could not be loaded.</p>
                            <p className="text-[0.7rem] opacity-90">{error}</p>
                        </div>
                    </div>
                ) : null}

                {/* Top summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                Intake
                            </CardTitle>
                            <CardDescription className="text-[0.7rem]">Needs assessments (Steps 1–3)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-amber-900">{intakeStats.total}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Last 7 days: <span className="font-semibold text-amber-900">{intakeStats.last7}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Avg score: <span className="font-semibold text-amber-900">{intakeStats.avg.toFixed(1)}</span>
                            </div>
                            <Button asChild size="sm" className="w-full text-xs">
                                <Link to="/dashboard/counselor/intake">Open Intake</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <CalendarClock className="h-4 w-4 text-amber-600" />
                                Appointments
                            </CardTitle>
                            <CardDescription className="text-[0.7rem]">Requests &amp; schedules</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-amber-900">{apptStats.total}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Pending: <span className="font-semibold text-amber-900">{apptStats.pending}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Final set: <span className="font-semibold text-amber-900">{apptStats.finalSet}</span>
                            </div>
                            <Button asChild size="sm" className="w-full text-xs">
                                <Link to="/dashboard/counselor/appointments">Open Appointments</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <MessageCircle className="h-4 w-4 text-amber-600" />
                                Messages
                            </CardTitle>
                            <CardDescription className="text-[0.7rem]">Inbox activity</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Conversations:{" "}
                                <span className="font-semibold text-amber-900">{messageStats.conversationCount}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Total msgs: <span className="font-semibold text-amber-900">{messageStats.total}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Unread: <span className="font-semibold text-amber-900">{messageStats.unread}</span>
                            </div>
                            <Button asChild size="sm" className="w-full text-xs">
                                <Link to="/dashboard/counselor/messages">Open Messages</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <Share2 className="h-4 w-4 text-amber-600" />
                                Referrals
                            </CardTitle>
                            <CardDescription className="text-[0.7rem]">Incoming referrals</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-amber-900">{referralStats.total}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Pending: <span className="font-semibold text-amber-900">{referralStats.pending}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Last 7 days: <span className="font-semibold text-amber-900">{referralStats.last7}</span>
                            </div>
                            <Button asChild size="sm" className="w-full text-xs">
                                <Link to="/dashboard/counselor/referrals">Open Referrals</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <UsersIcon className="h-4 w-4 text-amber-600" />
                                Users
                            </CardTitle>
                            <CardDescription className="text-[0.7rem]">Students &amp; guests</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Total: <span className="font-semibold text-amber-900">{userStats.total}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Students: <span className="font-semibold text-amber-900">{userStats.students}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Guests: <span className="font-semibold text-amber-900">{userStats.guests}</span>
                            </div>
                            <Button asChild size="sm" className="w-full text-xs">
                                <Link to="/dashboard/counselor/users">Open Users</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Intake severity distribution</CardTitle>
                            <CardDescription className="text-[0.7rem]">PHQ-style triage bands (not diagnostic)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={intakeStats.severityData}
                                            dataKey="value"
                                            nameKey="name"
                                            outerRadius={90}
                                            innerRadius={50}
                                            paddingAngle={2}
                                        >
                                            {intakeStats.severityData.map((_, idx) => (
                                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Appointments by status</CardTitle>
                            <CardDescription className="text-[0.7rem]">Pending / Scheduled / Completed / Cancelled</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={apptStats.statusData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Messages (last 14 days)</CardTitle>
                            <CardDescription className="text-[0.7rem]">Total messages per day</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                {messageStats.timeline.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading…
                                            </>
                                        ) : (
                                            "No timeline data yet."
                                        )}
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={messageStats.timeline} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Referrals by status</CardTitle>
                            <CardDescription className="text-[0.7rem]">Pending / Handled / Closed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={referralStats.statusData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#a855f7" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Users split</CardTitle>
                            <CardDescription className="text-[0.7rem]">Students vs Guests</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={userStats.roleData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent activity */}
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Recent intake submissions</CardTitle>
                            <CardDescription className="text-[0.7rem]">Latest 5 assessments</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading && assessments.length === 0 ? (
                                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : intakeStats.recent.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No intake submissions yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {intakeStats.recent.map((x) => (
                                        <div
                                            key={String(x.id)}
                                            className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="font-semibold text-amber-900">{x.student}</div>
                                                <div className="text-[0.7rem] text-muted-foreground">{x.submitted}</div>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                                                <span>
                                                    Score: <span className="font-semibold text-amber-900">{x.score}</span>
                                                </span>
                                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                                                    {x.severity}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                    >
                                        <Link to="/dashboard/counselor/intake">View all intake</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Recent appointment requests</CardTitle>
                            <CardDescription className="text-[0.7rem]">Latest 5 requests</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading && requests.length === 0 ? (
                                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : apptStats.recent.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No appointment requests yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {apptStats.recent.map((x) => (
                                        <div
                                            key={String(x.id)}
                                            className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="font-semibold text-amber-900">{x.student}</div>
                                                <div className="text-[0.7rem] text-muted-foreground">{x.requested}</div>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                                                    {x.status}
                                                </Badge>
                                                {x.concern !== "—" ? (
                                                    <span>
                                                        Concern: <span className="font-medium text-amber-900">{x.concern}</span>
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                    >
                                        <Link to="/dashboard/counselor/appointments">View all appointments</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Recent referrals</CardTitle>
                            <CardDescription className="text-[0.7rem]">Latest 5 referrals (shows referral user role)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading && referrals.length === 0 ? (
                                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : referralStats.recent.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No referrals yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {referralStats.recent.map((r) => (
                                        <div
                                            key={String(r.id)}
                                            className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="font-semibold text-amber-900">{r.student}</div>
                                                <div className="text-[0.7rem] text-muted-foreground">{r.created}</div>
                                            </div>

                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                                                    {r.status}
                                                </Badge>

                                                {r.urgency !== "—" ? (
                                                    <span>
                                                        Urgency: <span className="font-medium text-amber-900">{r.urgency}</span>
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="mt-1 text-[0.7rem] text-muted-foreground">
                                                Requested by: <span className="font-medium text-amber-900">{r.requestedBy}</span>
                                            </div>
                                        </div>
                                    ))}

                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                    >
                                        <Link to="/dashboard/counselor/referrals">View all referrals</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Recent messages</CardTitle>
                            <CardDescription className="text-[0.7rem]">Latest 5 messages</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading && messages.length === 0 ? (
                                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : messageStats.recent.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No messages yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {messageStats.recent.map((m) => (
                                        <div
                                            key={String(m.id)}
                                            className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 font-semibold text-amber-900">
                                                    <span>{m.sender}</span>
                                                    {m.isUnread ? (
                                                        <Badge
                                                            variant="secondary"
                                                            className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
                                                        >
                                                            NEW
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                <div className="text-[0.7rem] text-muted-foreground">{m.created}</div>
                                            </div>
                                            <div className="mt-1 text-[0.7rem] text-muted-foreground">
                                                {m.content ? (m.content.length > 80 ? `${m.content}…` : m.content) : "—"}
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                    >
                                        <Link to="/dashboard/counselor/messages">Go to inbox</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">Recently added users</CardTitle>
                            <CardDescription className="text-[0.7rem]">Latest 5 (if created_at is available)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading && users.length === 0 ? (
                                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading…
                                </div>
                            ) : userStats.recent.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No users loaded yet.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {userStats.recent.map((u) => (
                                        <div
                                            key={String(u.id)}
                                            className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="font-semibold text-amber-900">{u.name}</div>
                                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                                                    {u.role}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 text-[0.7rem] text-muted-foreground">{u.email}</div>
                                        </div>
                                    ))}
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                                    >
                                        <Link to="/dashboard/counselor/users">View all users</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default CounselorOverview;
