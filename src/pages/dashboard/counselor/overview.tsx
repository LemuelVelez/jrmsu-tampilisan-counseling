/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
    AlertCircle,
    ClipboardList as ClipboardListIcon,
    Loader2,
    RefreshCcw,
    ArrowRight,
    UserCircle2,
} from "lucide-react";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type {
    IntakeRequestDto,
    IntakeAssessmentDto,
    MentalFrequencyApi,
} from "@/api/intake/route";

import {
    getCurrentSession,
    subscribeToSession,
    type AuthSession,
} from "@/lib/authentication";
import { normalizeRole, resolveDashboardPathForRole } from "@/lib/role";

const CONCERN_LABELS: Record<string, string> = {
    academic: "Academic",
    personal: "Personal / emotional",
    family: "Family",
    mental_health: "Mental health",
    career: "Career / future",
    other: "Other",
};

const URGENCY_LABELS: Record<string, string> = {
    low: "Not urgent",
    medium: "Soon (within 1–2 weeks)",
    high: "Urgent (as soon as possible)",
};

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

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorFetch<T>(path: string): Promise<T> {
    const url = resolveApiUrl(path);

    const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
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

        const error = new Error(message) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

async function fetchCounselingRequests(): Promise<IntakeRequestDto[]> {
    const raw = await counselorFetch<any>("/counselor/intake/requests");

    const list =
        Array.isArray(raw) && raw.length && typeof raw[0] === "object"
            ? raw
            : Array.isArray(raw?.requests)
                ? raw.requests
                : Array.isArray(raw?.intakes)
                    ? raw.intakes
                    : Array.isArray(raw?.data)
                        ? raw.data
                        : [];

    return list as IntakeRequestDto[];
}

async function fetchAssessments(): Promise<IntakeAssessmentDto[]> {
    const raw = await counselorFetch<any>("/counselor/intake/assessments");

    const list =
        Array.isArray(raw) && raw.length && typeof raw[0] === "object"
            ? raw
            : Array.isArray(raw?.assessments)
                ? raw.assessments
                : Array.isArray(raw?.data)
                    ? raw.data
                    : [];

    return list as IntakeAssessmentDto[];
}

function getStudentDisplayName(record: any): string {
    const candidate =
        record?.student_name ??
        record?.student_full_name ??
        record?.full_name ??
        record?.name ??
        record?.user_name ??
        record?.user?.name;

    const id = record?.user_id ?? record?.student_id ?? record?.user?.id;

    if (candidate && typeof candidate === "string") return candidate;
    if (id !== undefined && id !== null) return `Student #${String(id)}`;
    return "Unknown student";
}

function formatDateTime(dateString?: string | null): string {
    if (!dateString || typeof dateString !== "string") return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy – h:mm a");
    } catch {
        return dateString;
    }
}

function formatConcernType(raw?: string | null): string {
    if (!raw) return "—";
    const value = raw.toLowerCase();
    if (CONCERN_LABELS[value]) return CONCERN_LABELS[value];
    return value
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function formatUrgency(raw?: string | null): string {
    if (!raw) return "—";
    const value = raw.toLowerCase();
    return URGENCY_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

function urgencyBadgeClass(raw?: string | null): string {
    const v = (raw ?? "").toLowerCase();
    if (v === "high") return "border-red-200 bg-red-50 text-red-800";
    if (v === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
    if (v === "low") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    return "border-slate-200 bg-slate-50 text-slate-800";
}

function calculatePhqScore(
    assessment: IntakeAssessmentDto,
): { score: number; answered: number } {
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

/**
 * Subscribe to global auth session.
 */
function useAuthSession(): AuthSession {
    const [session, setSession] = React.useState<AuthSession>(() => getCurrentSession());

    React.useEffect(() => {
        const unsub = subscribeToSession((next) => setSession(next));
        return unsub;
    }, []);

    return session;
}

const CounselorOverviewInner: React.FC = () => {
    const navigate = useNavigate();

    const [requests, setRequests] = React.useState<IntakeRequestDto[]>([]);
    const [assessments, setAssessments] = React.useState<IntakeAssessmentDto[]>([]);

    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [error, setError] = React.useState<string | null>(null);

    const fetchAll = React.useCallback(async () => {
        const [req, asmt] = await Promise.all([
            fetchCounselingRequests(),
            fetchAssessments(),
        ]);

        const sortedReq = [...req].sort((a, b) => {
            const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
            const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
            return bCreated - aCreated;
        });

        const sortedAsm = [...asmt].sort((a, b) => {
            const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
            const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
            return bCreated - aCreated;
        });

        setRequests(sortedReq);
        setAssessments(sortedAsm);
    }, []);

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            setIsLoading(true);
            setError(null);
            try {
                await fetchAll();
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Failed to load intake overview.";
                if (mounted) setError(msg);
                toast.error(msg);
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [fetchAll]);

    const onRefresh = async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            await fetchAll();
            toast.success("Refreshed intake overview.");
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : "Failed to refresh intake overview.";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsRefreshing(false);
        }
    };

    const totalRequests = requests.length;
    const totalAssessments = assessments.length;

    const pendingRequests = requests.filter(
        (r) => String(r.status ?? "").toLowerCase() === "pending",
    ).length;

    const highUrgency = requests.filter(
        (r) => String(r.urgency ?? "").toLowerCase() === "high",
    ).length;

    const latestRequest = requests[0];
    const latestAssessment = assessments[0];

    const scored = React.useMemo(() => {
        return assessments.map((a) => {
            const res = calculatePhqScore(a);
            return { ...res, id: a.id, created_at: a.created_at };
        });
    }, [assessments]);

    const severeCount = scored.filter((s) => s.answered > 0 && s.score >= 20).length;
    const moderatePlusCount = scored.filter((s) => s.answered > 0 && s.score >= 10).length;

    const avgScore = React.useMemo(() => {
        const valid = scored.filter((s) => s.answered > 0);
        if (valid.length === 0) return 0;
        const sum = valid.reduce((acc, s) => acc + s.score, 0);
        return Math.round((sum / valid.length) * 10) / 10;
    }, [scored]);

    const recentRequests = requests.slice(0, 5);
    const recentAssessments = assessments.slice(0, 5);

    return (
        <DashboardLayout
            title="Overview"
            description="Quick snapshot of counseling intake activity."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-5xl space-y-6">
                    {/* Top actions */}
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">
                                Guidance &amp; Counseling – Dashboard overview
                            </p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                This section summarizes the latest student intake submissions.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                                type="button"
                                size="sm"
                                className="gap-2"
                                onClick={() => navigate("/dashboard/counselor/intake")}
                            >
                                <ClipboardListIcon className="h-4 w-4" />
                                Open Intake
                                <ArrowRight className="h-4 w-4" />
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-2 border-amber-200 bg-white/80 text-amber-900 hover:bg-amber-50"
                                onClick={onRefresh}
                                disabled={isRefreshing || isLoading}
                            >
                                {isRefreshing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCcw className="h-4 w-4" />
                                )}
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {error ? (
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-800">
                            <AlertCircle className="mt-px h-3.5 w-3.5" />
                            <div>
                                <p className="font-medium">Unable to load overview.</p>
                                <p className="text-[0.7rem] opacity-90">{error}</p>
                            </div>
                        </div>
                    ) : null}

                    {/* Summary cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm font-semibold text-amber-900">
                                    Total requests
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Counseling requests (Step 4)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : (
                                    <div className="text-2xl font-semibold text-foreground">
                                        {totalRequests}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm font-semibold text-amber-900">
                                    Pending
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Requests needing triage
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : (
                                    <div className="text-2xl font-semibold text-foreground">
                                        {pendingRequests}
                                    </div>
                                )}
                                {!isLoading && highUrgency > 0 ? (
                                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                        <span className="font-medium text-red-700">
                                            {highUrgency}
                                        </span>{" "}
                                        high urgency
                                    </p>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm font-semibold text-amber-900">
                                    Assessments
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Steps 1–3 submissions
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : (
                                    <div className="text-2xl font-semibold text-foreground">
                                        {totalAssessments}
                                    </div>
                                )}
                                {!isLoading ? (
                                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                        Avg PHQ score:{" "}
                                        <span className="font-medium text-foreground">
                                            {avgScore}
                                        </span>
                                    </p>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-sm font-semibold text-amber-900">
                                    Moderate+ flags
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    For triage only
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-2xl font-semibold text-foreground">
                                            {moderatePlusCount}
                                        </div>
                                        <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                            Severe:{" "}
                                            <span className="font-medium text-red-700">
                                                {severeCount}
                                            </span>
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Separator />

                    {/* Recent activity */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Recent Requests */}
                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                    <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                    Recent counseling requests
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Latest Step 4 submissions
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {isLoading ? (
                                    <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : totalRequests === 0 ? (
                                    <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                        No counseling requests yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentRequests.map((r) => {
                                            const student = getStudentDisplayName(r);
                                            const created = formatDateTime(r.created_at);
                                            const concern = formatConcernType(r.concern_type ?? undefined);
                                            const urgency = formatUrgency(r.urgency ?? undefined);

                                            return (
                                                <div
                                                    key={r.id}
                                                    className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                                                            <UserCircle2 className="h-3.5 w-3.5 text-amber-700" />
                                                            <span>{student}</span>
                                                        </div>
                                                        <span className="text-[0.65rem] text-muted-foreground">
                                                            {created}
                                                        </span>
                                                    </div>

                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.7rem] font-medium text-amber-900">
                                                            Concern: {concern}
                                                        </span>
                                                        {r.urgency ? (
                                                            <span
                                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${urgencyBadgeClass(
                                                                    r.urgency,
                                                                )}`}
                                                            >
                                                                {urgency}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {latestRequest ? (
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                Latest request:{" "}
                                                <span className="font-medium text-foreground">
                                                    {formatDateTime(latestRequest.created_at)}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Assessments */}
                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                    <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                    Recent assessments
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Latest Steps 1–3 submissions (triage summary)
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {isLoading ? (
                                    <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading…
                                    </div>
                                ) : totalAssessments === 0 ? (
                                    <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                        No assessment submissions yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentAssessments.map((a) => {
                                            const student = getStudentDisplayName(a);
                                            const created = formatDateTime(a.created_at);
                                            const { score, answered } = calculatePhqScore(a);
                                            const severity = answered > 0 ? phqSeverityLabel(score) : "—";

                                            return (
                                                <div
                                                    key={a.id}
                                                    className="rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2 text-xs"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                                                            <UserCircle2 className="h-3.5 w-3.5 text-amber-700" />
                                                            <span>{student}</span>
                                                        </div>
                                                        <span className="text-[0.65rem] text-muted-foreground">
                                                            {created}
                                                        </span>
                                                    </div>

                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.7rem] font-medium text-amber-900">
                                                            Score: {score}{" "}
                                                            <span className="text-[0.65rem] text-muted-foreground">
                                                                ({answered}/9)
                                                            </span>
                                                        </span>
                                                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.7rem] font-medium text-amber-900">
                                                            Severity: {severity}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {latestAssessment ? (
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                Latest assessment:{" "}
                                                <span className="font-medium text-foreground">
                                                    {formatDateTime(latestAssessment.created_at)}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

const CounselorOverviewPage: React.FC = () => {
    const session = useAuthSession();
    const me = session.user;
    const role = normalizeRole(me?.role ?? "");

    if (!me) return <Navigate to="/auth" replace />;

    // Only counselors should stay here
    const isCounselor =
        role.includes("counselor") || role.includes("counsellor");

    if (!isCounselor) {
        const path = resolveDashboardPathForRole(me.role ?? "");
        return <Navigate to={path} replace />;
    }

    return <CounselorOverviewInner />;
};

export default CounselorOverviewPage;
