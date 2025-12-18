/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ClipboardList,
    MessageCircle,
    CalendarClock,
    Activity,
    PieChart as PieIcon,
    AreaChart as AreaChartIcon,
    Loader2,
    AlertCircle,
    ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { fetchStudentAssessments, type StudentAssessment } from "@/lib/intake";
import { fetchStudentEvaluations, type StudentEvaluation as StudentEvaluationEntry } from "@/lib/evaluation";
import { fetchStudentMessages, type StudentMessage } from "@/lib/messages";
import { format, parseISO, startOfToday, startOfMonth } from "date-fns";

import {
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

type OverviewStats = {
    totalAssessments: number;
    lastAssessmentDate: string | null;
    totalRequests: number;
    upcomingRequests: number;
    pastRequests: number;

    // ✅ Messages overview aligned with Messages page threading
    unreadMessages: number; // unread from counselor/system
    totalConversations: number;
    unreadConversations: number;
    lastMessageAt: string | null;
};

type StatusPieDatum = {
    status: string;
    label: string;
    value: number;
};

type TrendDatum = {
    month: string;
    requests: number;
    assessments: number;
    _sortDate: Date;
};

type UiSender = "student" | "guest" | "counselor" | "system";

type UiMessage = {
    id: number | string;
    conversationId: string;

    sender: UiSender;
    senderName: string;
    content: string;
    createdAt: string;

    senderId?: number | string | null;
    recipientId?: number | string | null;
    recipientRole?: string | null;
    userId?: number | string | null;

    isUnreadOffice: boolean; // unread + from counselor/system (matches overview + what students care about)
};

type ConversationSummary = {
    id: string;
    counselorId?: number | string | null;
    counselorName: string;
    unreadCount: number; // unread office msgs
    lastMessage?: string;
    lastTimestamp?: string;
};

const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
];

function isUpcoming(evaluation: StudentEvaluationEntry): boolean {
    if (!evaluation.preferred_date) return false;
    try {
        const date = parseISO(evaluation.preferred_date);
        const today = startOfToday();
        return date >= today;
    } catch {
        return false;
    }
}

function formatDateDisplay(dateString?: string | null): string {
    if (!dateString) return "—";
    try {
        const date = parseISO(dateString);
        return format(date, "MMM d, yyyy");
    } catch {
        return dateString;
    }
}

function formatTimestampDisplay(iso?: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return format(d, "MMM d, yyyy • h:mm a");
}

function initials(name: string) {
    const cleaned = (name || "").trim();
    if (!cleaned) return "GC";
    const parts = cleaned.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "GC";
}

function buildStatusPieData(evaluations: StudentEvaluationEntry[]): StatusPieDatum[] {
    const statusCounts: Record<string, number> = {};

    for (const evaluation of evaluations) {
        const rawStatus = (evaluation.status ?? "pending").toString();
        const normalized = rawStatus.toLowerCase();

        const key =
            normalized === "pending" ||
                normalized === "in_review" ||
                normalized === "scheduled" ||
                normalized === "closed"
                ? normalized
                : "other";

        statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    }

    const labelMap: Record<string, string> = {
        pending: "Pending review",
        in_review: "In review",
        scheduled: "Scheduled",
        closed: "Closed",
        other: "Other",
    };

    return Object.entries(statusCounts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
            status,
            label: labelMap[status] ?? status,
            value: count,
        }));
}

function buildTrendData(evaluations: StudentEvaluationEntry[], assessments: StudentAssessment[]): TrendDatum[] {
    const map = new Map<string, TrendDatum>();

    const addMonth = (dateString: string | null | undefined, kind: "request" | "assessment") => {
        if (!dateString) return;
        try {
            const date = parseISO(dateString);
            const monthStart = startOfMonth(date);
            const key = format(monthStart, "yyyy-MM");
            const label = format(monthStart, "MMM yyyy");

            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    month: label,
                    requests: kind === "request" ? 1 : 0,
                    assessments: kind === "assessment" ? 1 : 0,
                    _sortDate: monthStart,
                });
            } else {
                if (kind === "request") existing.requests += 1;
                else existing.assessments += 1;
            }
        } catch {
            // ignore invalid dates
        }
    };

    evaluations.forEach((evaluation) => addMonth(evaluation.created_at ?? evaluation.preferred_date, "request"));
    assessments.forEach((assessment) => addMonth(assessment.created_at ?? undefined, "assessment"));

    const all = Array.from(map.values()).sort((a, b) => a._sortDate.getTime() - b._sortDate.getTime());
    return all.slice(-6);
}

// ✅ Messages overview logic aligned with Messages page threading (conversation_id or derived)
function normalizeSender(sender: StudentMessage["sender"]): UiSender {
    if (sender === "student" || sender === "guest" || sender === "counselor" || sender === "system") return sender;
    return "system";
}

function safeConversationIdStudent(dto: StudentMessage): string {
    const raw = (dto as any).conversation_id ?? (dto as any).conversationId;
    if (raw != null && String(raw).trim()) return String(raw);

    const sender = normalizeSender(dto.sender);
    const senderId = (dto as any).sender_id ?? null;

    const recipientRole = (dto as any).recipient_role ?? null;
    const recipientId = (dto as any).recipient_id ?? null;

    const counselorId =
        (sender === "counselor" ? senderId : null) ??
        (recipientRole === "counselor" ? recipientId : null) ??
        (dto as any).counselor_id ??
        null;

    if (counselorId != null && String(counselorId).trim()) return `counselor-${String(counselorId)}`;
    return "counselor-office";
}

function mapDtoToUi(dto: StudentMessage, index: number): UiMessage {
    const sender = normalizeSender(dto.sender);
    const createdAt = dto.created_at ?? new Date(0).toISOString();
    const fallbackId = `${createdAt}-${sender}-${index}`;

    const senderName =
        (dto.sender_name && String(dto.sender_name).trim()) ||
        (sender === "system" ? "Guidance & Counseling Office" : sender === "counselor" ? "Counselor" : "You");

    const isUnread = dto.is_read === false || dto.is_read === 0;
    const isFromOffice = sender === "counselor" || sender === "system";

    return {
        id: dto.id ?? fallbackId,
        conversationId: safeConversationIdStudent(dto),

        sender,
        senderName,
        content: dto.content ?? "",
        createdAt,

        senderId: (dto as any).sender_id ?? null,
        recipientId: (dto as any).recipient_id ?? null,
        recipientRole: (dto as any).recipient_role ?? null,
        userId: (dto as any).user_id ?? null,

        isUnreadOffice: Boolean(isFromOffice && isUnread),
    };
}

function buildConversationSummaries(messages: StudentMessage[]): ConversationSummary[] {
    const ui = messages.map((m, idx) => mapDtoToUi(m, idx));

    const grouped = new Map<string, UiMessage[]>();
    for (const m of ui) {
        const arr = grouped.get(m.conversationId) ?? [];
        arr.push(m);
        grouped.set(m.conversationId, arr);
    }

    const summaries: ConversationSummary[] = [];

    for (const [conversationId, msgs] of grouped.entries()) {
        const ordered = [...msgs].sort((a, b) => {
            const ta = new Date(a.createdAt).getTime();
            const tb = new Date(b.createdAt).getTime();
            if (ta !== tb) return ta - tb;
            return String(a.id).localeCompare(String(b.id));
        });

        const last = ordered[ordered.length - 1];

        const unreadCount = ordered.filter((m) => m.isUnreadOffice).length;

        const counselorMsg = ordered.find((m) => m.sender === "counselor") ?? null;

        const counselorId =
            counselorMsg?.senderId ??
            ordered.find((m) => m.recipientRole === "counselor" && m.recipientId != null)?.recipientId ??
            (conversationId.startsWith("counselor-") ? conversationId.replace("counselor-", "") : null);

        const counselorName =
            (counselorMsg?.senderName && counselorMsg.senderName !== "Counselor" ? counselorMsg.senderName : "") ||
            (counselorId != null ? `Counselor #${counselorId}` : "Guidance & Counseling Office");

        summaries.push({
            id: conversationId,
            counselorId: counselorId ?? null,
            counselorName,
            unreadCount,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
        });
    }

    summaries.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return tb - ta;
    });

    return summaries;
}

function countUnreadMessages(messages: StudentMessage[]): number {
    return messages.filter((m) => {
        const sender = (m.sender ?? "").toString();
        const isFromOffice = sender === "counselor" || sender === "system";
        const isUnread = m.is_read === false || m.is_read === 0;
        return isFromOffice && isUnread;
    }).length;
}

const StudentOverview: React.FC = () => {
    const [assessments, setAssessments] = React.useState<StudentAssessment[]>([]);
    const [evaluations, setEvaluations] = React.useState<StudentEvaluationEntry[]>([]);

    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    const [statusPieData, setStatusPieData] = React.useState<StatusPieDatum[]>([]);
    const [trendData, setTrendData] = React.useState<TrendDatum[]>([]);

    // ✅ NEW: recent threads preview (aligned with Messages page)
    const [recentConversations, setRecentConversations] = React.useState<ConversationSummary[]>([]);

    const [stats, setStats] = React.useState<OverviewStats>({
        totalAssessments: 0,
        lastAssessmentDate: null,
        totalRequests: 0,
        upcomingRequests: 0,
        pastRequests: 0,

        unreadMessages: 0,
        totalConversations: 0,
        unreadConversations: 0,
        lastMessageAt: null,
    });

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [assessmentsResponse, evaluationsResponse, messagesResponse] = await Promise.all([
                fetchStudentAssessments(),
                fetchStudentEvaluations(),
                fetchStudentMessages(),
            ]);

            const assessmentsData: StudentAssessment[] = assessmentsResponse.assessments ?? [];
            const evaluationsData: StudentEvaluationEntry[] = evaluationsResponse.appointments ?? [];
            const messagesData: StudentMessage[] = messagesResponse.messages ?? [];

            setAssessments(assessmentsData);
            setEvaluations(evaluationsData);

            // ✅ Messages aligned with Messages.tsx
            const unread = countUnreadMessages(messagesData);
            const convos = buildConversationSummaries(messagesData);
            const unreadThreads = convos.filter((c) => c.unreadCount > 0).length;
            const lastMessageAt = convos[0]?.lastTimestamp ? formatTimestampDisplay(convos[0].lastTimestamp) : null;

            setRecentConversations(convos.slice(0, 4));

            // Stats
            const totalAssessments = assessmentsData.length;
            const totalRequests = evaluationsData.length;
            const upcomingRequests = evaluationsData.filter(isUpcoming).length;
            const pastRequests = totalRequests - upcomingRequests;

            let lastAssessmentDate: string | null = null;
            if (assessmentsData.length > 0) {
                const sortedByDate = [...assessmentsData].sort((a, b) => {
                    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return db - da;
                });
                lastAssessmentDate = formatDateDisplay(sortedByDate[0].created_at);
            }

            setStats({
                totalAssessments,
                lastAssessmentDate,
                totalRequests,
                upcomingRequests,
                pastRequests,

                unreadMessages: unread,
                totalConversations: convos.length,
                unreadConversations: unreadThreads,
                lastMessageAt,
            });

            setStatusPieData(buildStatusPieData(evaluationsData));
            setTrendData(buildTrendData(evaluationsData, assessmentsData));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load your dashboard overview.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const hasAnyRequests = evaluations.length > 0;
    const hasAnyAssessments = assessments.length > 0;

    return (
        <DashboardLayout
            title="Student dashboard"
            description="See a quick overview of your intake forms, messages, and evaluation history in one place."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-5xl space-y-4">
                    {/* Top: overview of the three student pages */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <ClipboardList className="h-4 w-4 text-amber-700" />
                                    Intake
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs text-muted-foreground">
                                <p>
                                    Fill out the Mental Health Needs Assessment and submit a counseling intake request with your main concern
                                    and preferred schedule.
                                </p>
                                <Button asChild size="sm" className="h-7 px-2 text-[0.7rem]" variant="outline">
                                    <Link to="/dashboard/student/intake">
                                        Go to Intake
                                        <ArrowRight className="ml-1 h-3 w-3" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <MessageCircle className="h-4 w-4 text-amber-700" />
                                    Messages
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs text-muted-foreground">
                                <p>
                                    View updates from the Guidance &amp; Counseling Office and message counselors in private conversation
                                    threads.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="text-[0.65rem]">
                                        {stats.totalConversations} threads
                                    </Badge>
                                    {stats.unreadConversations > 0 ? (
                                        <Badge className="border-sky-200 bg-sky-100 text-[0.65rem] text-sky-900">
                                            {stats.unreadConversations} unread threads
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[0.65rem]">
                                            No unread threads
                                        </Badge>
                                    )}
                                </div>

                                <Button asChild size="sm" className="h-7 px-2 text-[0.7rem]" variant="outline">
                                    <Link to="/dashboard/student/messages">
                                        Go to Messages
                                        <ArrowRight className="ml-1 h-3 w-3" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <CalendarClock className="h-4 w-4 text-amber-700" />
                                    Evaluation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs text-muted-foreground">
                                <p>
                                    Review your submitted assessments and counseling requests, including their current status, schedule, and
                                    editable details.
                                </p>
                                <Button asChild size="sm" className="h-7 px-2 text-[0.7rem]" variant="outline">
                                    <Link to="/dashboard/student/evaluation">
                                        Go to Evaluation
                                        <ArrowRight className="ml-1 h-3 w-3" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Loading / error state */}
                    {isLoading && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading your dashboard data…</span>
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-800">
                            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-medium">Unable to load overview</p>
                                <p className="mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Key stats row */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-emerald-100/80 bg-emerald-50/60 shadow-sm shadow-emerald-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                                    <span>Assessments</span>
                                    <Activity className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 text-xs text-slate-700">
                                <p className="text-2xl font-semibold text-emerald-900">{stats.totalAssessments}</p>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    Total Mental Health Needs Assessments you&apos;ve submitted.
                                </p>
                                <p className="text-[0.7rem] text-slate-700">
                                    Last assessment: <span className="font-medium">{stats.lastAssessmentDate ?? "None yet"}</span>
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100/80 bg-amber-50/60 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-amber-900">
                                    <span>Counseling requests</span>
                                    <CalendarClock className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 text-xs text-slate-700">
                                <p className="text-2xl font-semibold text-amber-900">{stats.totalRequests}</p>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    Total counseling intake requests you&apos;ve submitted.
                                </p>
                                <div className="flex flex-wrap gap-2 text-[0.7rem]">
                                    <span>
                                        Upcoming:&nbsp;<span className="font-medium">{stats.upcomingRequests}</span>
                                    </span>
                                    <span>
                                        Past:&nbsp;<span className="font-medium">{stats.pastRequests}</span>
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-sky-100/80 bg-sky-50/60 shadow-sm shadow-sky-100/60 backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="flex items-center justify-between text-xs font-semibold text-sky-900">
                                    <span>Messages</span>
                                    <MessageCircle className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 text-xs text-slate-700">
                                <p className="text-2xl font-semibold text-sky-900">{stats.unreadMessages}</p>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    Unread messages from the Guidance &amp; Counseling Office.
                                </p>

                                <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-700">
                                    <span>
                                        Threads:&nbsp;<span className="font-medium">{stats.totalConversations}</span>
                                    </span>
                                    <span>
                                        Unread threads:&nbsp;<span className="font-medium">{stats.unreadConversations}</span>
                                    </span>
                                </div>

                                <p className="text-[0.7rem] text-slate-700">
                                    Last update:&nbsp;<span className="font-medium">{stats.lastMessageAt ?? "—"}</span>
                                </p>

                                {stats.unreadMessages > 0 ? (
                                    <Badge className="mt-1 border-sky-200 bg-sky-100 text-[0.65rem] text-sky-900">
                                        You have new updates waiting
                                    </Badge>
                                ) : (
                                    <span className="mt-1 text-[0.7rem] text-slate-600">You&apos;re all caught up.</span>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ✅ NEW: Recent message threads preview (overview of Messages page) */}
                    <Card className="border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
                        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <MessageCircle className="h-4 w-4" />
                                    Recent conversations
                                </CardTitle>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    A quick preview of your private threads (same grouping as the Messages page).
                                </p>
                            </div>

                            <Button asChild size="sm" variant="outline" className="h-8 px-3 text-[0.75rem]">
                                <Link to="/dashboard/student/messages">
                                    Open Messages
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {recentConversations.length === 0 ? (
                                <div className="rounded-md border bg-white/60 p-4 text-[0.75rem] text-muted-foreground">
                                    No conversations yet. Go to Messages to start a new thread with a counselor.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentConversations.map((c, idx) => (
                                        <React.Fragment key={c.id}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="text-sm font-semibold text-slate-900">{c.counselorName}</div>
                                                        <Badge variant="secondary" className="text-[0.65rem]">
                                                            {initials(c.counselorName)}
                                                        </Badge>
                                                        {c.unreadCount > 0 ? (
                                                            <Badge className="border-sky-200 bg-sky-100 text-[0.65rem] text-sky-900">
                                                                {c.unreadCount} new
                                                            </Badge>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-1 line-clamp-2 text-[0.75rem] text-muted-foreground">
                                                        {c.lastMessage || "No messages yet."}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <div className="text-[0.70rem] text-muted-foreground">
                                                        {formatDateDisplay(c.lastTimestamp ?? null)}
                                                    </div>
                                                    <div className="mt-2">
                                                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[0.7rem]">
                                                            <Link to="/dashboard/student/messages">View</Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {idx < recentConversations.length - 1 ? <Separator /> : null}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Charts row: Pie + Area */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Pie chart: request status */}
                        <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                            <CardHeader className="flex items-center justify-between space-y-0">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                        <PieIcon className="h-4 w-4" />
                                        Request status overview
                                    </CardTitle>
                                    <p className="text-[0.7rem] text-muted-foreground">
                                        Distribution of your counseling requests by status.
                                    </p>
                                </div>
                                <Badge className="border-amber-200 bg-amber-50 text-[0.65rem] text-amber-900">
                                    {stats.totalRequests} total
                                </Badge>
                            </CardHeader>
                            <CardContent className="h-64">
                                {hasAnyRequests && statusPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={statusPieData}
                                                dataKey="value"
                                                nameKey="label"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={4}
                                            >
                                                {statusPieData.map((entry, index) => (
                                                    <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: unknown, _name, props) => {
                                                    const label = (props?.payload as any)?.label;
                                                    return [`${value}`, label];
                                                }}
                                            />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={32}
                                                formatter={(value: unknown) => (
                                                    <span className="text-[0.7rem] text-slate-700">{String(value)}</span>
                                                )}
                                            />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-center text-[0.7rem] text-muted-foreground">
                                        You don&apos;t have any counseling requests yet. Submit one on the Intake page to see status insights
                                        here.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Area chart: activity over time */}
                        <Card className="border-emerald-100/80 bg-white/80 shadow-sm shadow-emerald-100/60 backdrop-blur">
                            <CardHeader className="flex items-center justify-between space-y-0">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                                        <AreaChartIcon className="h-4 w-4" />
                                        Activity over time
                                    </CardTitle>
                                    <p className="text-[0.7rem] text-muted-foreground">
                                        How many assessments and counseling requests you submitted per month.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent className="h-64">
                                {(hasAnyAssessments || hasAnyRequests) && trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                                            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} />
                                            <Tooltip contentStyle={{ fontSize: "0.7rem" }} />
                                            <Legend
                                                wrapperStyle={{ marginTop: 8, fontSize: "0.7rem", lineHeight: "1.4" }}
                                                formatter={(value: unknown) => (
                                                    <span className="text-[0.7rem] leading-4 text-slate-700">{String(value)}</span>
                                                )}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="requests"
                                                name="Counseling requests"
                                                stroke={chartColors[0]}
                                                fill={chartColors[0]}
                                                fillOpacity={0.22}
                                                strokeWidth={2}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="assessments"
                                                name="Assessments"
                                                stroke={chartColors[1]}
                                                fill={chartColors[1]}
                                                fillOpacity={0.2}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-center text-[0.7rem] text-muted-foreground">
                                        Once you submit assessments or counseling requests, this chart will help you see how active
                                        you&apos;ve been over time.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Refresh button at the bottom */}
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void loadData()}
                            disabled={isLoading}
                            className="h-7 px-3 text-[0.7rem]"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Refresh overview
                                </>
                            ) : (
                                "Refresh overview"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentOverview;
