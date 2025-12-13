/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    AlertCircle,
    CalendarClock,
    ClipboardList as ClipboardListIcon,
    Loader2,
    UserCircle2,
} from "lucide-react";
import { format, parseISO, startOfToday } from "date-fns";

import { fetchStudentEvaluations } from "@/lib/evaluation";
import type { StudentEvaluation as StudentEvaluationEntry } from "@/lib/evaluation";
import { fetchStudentAssessments, type StudentAssessment } from "@/lib/intake";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

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

type MentalFrequencyApi =
    | "not_at_all"
    | "several_days"
    | "more_than_half"
    | "nearly_every_day";

const MENTAL_FREQUENCY_LABELS: Record<string, string> = {
    not_at_all: "Not at all",
    several_days: "Several days",
    more_than_half: "More than half the days",
    nearly_every_day: "Nearly every day",
};

const MH_KEYS = [
    "mh_little_interest",
    "mh_feeling_down",
    "mh_sleep",
    "mh_energy",
    "mh_appetite",
    "mh_self_esteem",
    "mh_concentration",
    "mh_motor",
    "mh_self_harm",
] as const;

const MH_QUESTIONS: Record<(typeof MH_KEYS)[number], string> = {
    mh_little_interest: "Little interest or pleasure in doing things",
    mh_feeling_down: "Feeling down, depressed, or hopeless",
    mh_sleep: "Trouble falling/staying asleep, or sleeping too much",
    mh_energy: "Feeling tired or having little energy",
    mh_appetite: "Poor appetite or overeating",
    mh_self_esteem:
        "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    mh_concentration:
        "Trouble concentrating on things (e.g., reading or watching television)",
    mh_motor: "Moving/speaking slowly, or the opposite — fidgety/restless",
    mh_self_harm: "Thoughts that you would be better off dead or of hurting yourself",
};

function StatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();

    let label = status;
    let className = "border px-2 py-0.5 rounded-full text-[0.7rem] font-medium";

    switch (normalized) {
        case "pending":
            label = "Pending review";
            className += " bg-amber-50 text-amber-800 border-amber-200";
            break;
        case "in_review":
            label = "In review";
            className += " bg-sky-50 text-sky-800 border-sky-200";
            break;
        case "scheduled":
            label = "Scheduled";
            className += " bg-emerald-50 text-emerald-800 border-emerald-200";
            break;
        case "completed":
            label = "Completed";
            className += " bg-emerald-50 text-emerald-800 border-emerald-200";
            break;
        case "cancelled":
        case "canceled":
            label = "Cancelled";
            className += " bg-slate-50 text-slate-700 border-slate-200 line-through";
            break;
        case "closed":
            label = "Closed";
            className += " bg-slate-50 text-slate-700 border-slate-200";
            break;
        default:
            label = status;
            className += " bg-muted text-muted-foreground border-muted-foreground/20";
    }

    return <Badge className={className}>{label}</Badge>;
}

function normalizeText(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function formatDateDisplay(dateString?: string | null): string {
    if (!dateString) return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy");
    } catch {
        return dateString;
    }
}

function formatDateTime(dateString?: string | null): string {
    if (!dateString) return "—";
    try {
        return format(parseISO(dateString), "MMM d, yyyy – h:mm a");
    } catch {
        return dateString;
    }
}

function formatConcernType(raw?: string | null): string {
    if (!raw) return "—";
    const v = normalizeText(raw);
    if (CONCERN_LABELS[v]) return CONCERN_LABELS[v];
    return v
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function formatUrgency(raw?: string | null): string {
    if (!raw) return "—";
    const v = normalizeText(raw);
    return URGENCY_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

function prettyFrequency(value?: string | null): string {
    if (!value) return "—";
    const v = String(value) as MentalFrequencyApi | string;
    return MENTAL_FREQUENCY_LABELS[v] ?? String(value);
}

// Final schedule should come from scheduled_* when present
function getFinalDate(req: any): string | null {
    return (req?.scheduled_date as string | null) ?? null;
}
function getFinalTime(req: any): string | null {
    return (req?.scheduled_time as string | null) ?? null;
}

function formatPreferredDateTime(evaluation: StudentEvaluationEntry): string {
    if (!evaluation.preferred_date) return "To be scheduled";

    try {
        const date = parseISO(evaluation.preferred_date);
        const dateText = format(date, "MMM d, yyyy");
        const timeText = evaluation.preferred_time || "time to be confirmed";
        return `${dateText} · ${timeText}`;
    } catch {
        return `${evaluation.preferred_date}${evaluation.preferred_time ? ` · ${evaluation.preferred_time}` : ""
            }`;
    }
}

function formatFinalDateTime(evaluation: any): string {
    const d = getFinalDate(evaluation);
    const t = getFinalTime(evaluation);

    if (!d || !t) return "Not yet scheduled";

    try {
        const dateText = format(parseISO(d), "MMM d, yyyy");
        return `${dateText} · ${String(t)}`;
    } catch {
        return `${String(d)} · ${String(t)}`;
    }
}

function isUpcoming(evaluation: any): boolean {
    const dateStr = getFinalDate(evaluation) ?? evaluation?.preferred_date ?? null;
    if (!dateStr) return false;

    try {
        const date = parseISO(dateStr);
        const today = startOfToday();
        return date >= today;
    } catch {
        return false;
    }
}

function formatGender(raw?: string | null): string {
    if (!raw) return "—";
    const v = normalizeText(raw);
    if (v.startsWith("m")) return "Male";
    if (v.startsWith("f")) return "Female";
    if (v === "non_binary_other" || v.includes("non") || v.includes("other")) {
        return "Non-binary / Other";
    }
    return raw;
}

function formatLivingSituation(raw?: string | null, other?: string | null): string {
    if (!raw) return "—";
    const v = normalizeText(raw);
    if (v === "alone") return "Alone";
    if (v === "with_family") return "With family";
    if (v === "with_friends") return "With friends";
    if (v === "other") return other?.trim() ? `Other – ${other.trim()}` : "Other";
    return raw;
}

function getAssessmentHasAnyResponses(assessment: any): boolean {
    return MH_KEYS.some((k) => Boolean(assessment?.[k]));
}

const StudentEvaluation: React.FC = () => {
    const [evaluations, setEvaluations] = React.useState<StudentEvaluationEntry[]>([]);
    const [assessments, setAssessments] = React.useState<StudentAssessment[]>([]);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    // Preview dialog state (no editing)
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<"assessment" | "request">(
        "assessment",
    );
    const [selectedAssessment, setSelectedAssessment] =
        React.useState<StudentAssessment | null>(null);
    const [selectedRequest, setSelectedRequest] =
        React.useState<StudentEvaluationEntry | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [evaluationsResponse, assessmentsResponse] = await Promise.all([
                fetchStudentEvaluations(),
                fetchStudentAssessments(),
            ]);

            setEvaluations(evaluationsResponse.appointments ?? []);
            setAssessments(assessmentsResponse.assessments ?? []);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to load your evaluation data.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const upcomingEvaluations = evaluations.filter(isUpcoming);
    const pastEvaluations = evaluations.filter((e) => !isUpcoming(e));

    const hasAnyData = evaluations.length > 0 || assessments.length > 0;

    const closeDialog = () => {
        setIsDialogOpen(false);
        setSelectedAssessment(null);
        setSelectedRequest(null);
    };

    const openAssessmentPreview = (assessment: StudentAssessment) => {
        setDialogMode("assessment");
        setSelectedAssessment(assessment);
        setSelectedRequest(null);
        setIsDialogOpen(true);
    };

    const openRequestPreview = (req: StudentEvaluationEntry) => {
        setDialogMode("request");
        setSelectedRequest(req);
        setSelectedAssessment(null);
        setIsDialogOpen(true);
    };

    const dialogTitle =
        dialogMode === "assessment" ? "Assessment preview" : "Counseling request preview";

    const dialogSubtitle =
        dialogMode === "assessment"
            ? selectedAssessment
                ? `Submitted: ${formatDateTime((selectedAssessment as any).created_at)}`
                : "—"
            : selectedRequest
                ? `Requested: ${formatDateTime(selectedRequest.created_at)}`
                : "—";

    return (
        <DashboardLayout
            title="Evaluation"
            description="Preview your mental health assessments (Steps 1–3) and counseling requests in one place. This page is read-only."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-4xl space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">Guidance &amp; Counseling – Evaluation</p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                Preview-only: you can view your submitted records here, but you cannot
                                modify them from this page.
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void loadData()}
                                disabled={isLoading}
                                className="border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Refreshing…
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5" />
                                        Refresh
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <CalendarClock className="h-4 w-4" />
                                <span>Evaluation – assessments &amp; counseling history</span>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This page shows your submitted mental health assessments (Steps 1–3) and your
                                counseling requests. Use the preview buttons to view full details.
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {isLoading && (
                                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading your evaluation data…
                                </div>
                            )}

                            {!isLoading && error && (
                                <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50/70 px-3 py-2 text-xs text-red-800">
                                    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">Unable to load evaluation data</p>
                                        <p className="mt-0.5">{error}</p>
                                    </div>
                                </div>
                            )}

                            {!isLoading && !error && !hasAnyData && (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-amber-900">
                                    You haven’t submitted any assessments or counseling requests yet.
                                    <br />
                                    <span className="mt-1 inline-block">
                                        Start by filling out the <span className="font-semibold">Intake</span>{" "}
                                        form in the sidebar.
                                    </span>
                                </div>
                            )}

                            {!isLoading && !error && hasAnyData && (
                                <div className="space-y-6">
                                    {/* Assessment history */}
                                    <section className="space-y-2">
                                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                            <h2 className="text-xs font-semibold text-amber-900">
                                                Assessment history (Steps 1–3)
                                            </h2>
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                Preview your submitted intake assessment(s).
                                            </p>
                                        </div>

                                        {assessments.length === 0 ? (
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                You haven’t submitted any assessments yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-2 text-xs">
                                                {assessments.map((assessment) => {
                                                    const a: any = assessment as any;
                                                    const submitted = formatDateTime(a?.created_at);

                                                    return (
                                                        <div
                                                            key={(assessment as any).id ?? submitted}
                                                            className="flex flex-col gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <div className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-emerald-900">
                                                                    <UserCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                                                    <span>Assessment submitted</span>
                                                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-900">
                                                                        Consent: {a?.consent ? "Yes" : "No"}
                                                                    </span>
                                                                </div>

                                                                <p className="text-[0.7rem] text-muted-foreground">
                                                                    Submitted:{" "}
                                                                    <span className="font-medium text-emerald-900">{submitted}</span>
                                                                </p>

                                                                <p className="text-[0.7rem] text-slate-700">
                                                                    <span className="font-medium">Age:</span>{" "}
                                                                    {typeof a?.age === "number" ? a.age : "—"}{" "}
                                                                    <span className="mx-1">•</span>{" "}
                                                                    <span className="font-medium">Gender:</span>{" "}
                                                                    {formatGender(a?.gender)} <span className="mx-1">•</span>{" "}
                                                                    <span className="font-medium">Occupation:</span>{" "}
                                                                    {a?.occupation?.trim?.() ? a.occupation.trim() : "—"}
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-emerald-200 bg-white/80 text-[0.7rem] text-emerald-900 hover:bg-emerald-50"
                                                                    onClick={() => openAssessmentPreview(assessment)}
                                                                >
                                                                    View / Preview
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    {/* Counseling requests */}
                                    <section className="space-y-5">
                                        {/* Upcoming */}
                                        <section className="space-y-2">
                                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                                <h2 className="text-xs font-semibold text-amber-900">
                                                    Upcoming / active requests
                                                </h2>
                                                <p className="text-[0.7rem] text-muted-foreground">
                                                    Uses counselor final schedule when available; otherwise your preferred
                                                    date.
                                                </p>
                                            </div>

                                            {upcomingEvaluations.length === 0 ? (
                                                <p className="text-[0.7rem] text-muted-foreground">
                                                    No upcoming requests/sessions yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-2 text-xs">
                                                    {upcomingEvaluations.map((evaluation) => {
                                                        const concern = formatConcernType(evaluation.concern_type ?? undefined);
                                                        const urgency = formatUrgency(evaluation.urgency ?? undefined);
                                                        const preferred = formatPreferredDateTime(evaluation);
                                                        const finalSchedule = formatFinalDateTime(evaluation as any);

                                                        return (
                                                            <div
                                                                key={evaluation.id}
                                                                className="flex flex-col gap-2 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                                                            >
                                                                <div className="space-y-0.5">
                                                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                                                        <p className="font-medium text-amber-900">
                                                                            {concern || "Counseling request"}
                                                                        </p>
                                                                        <StatusBadge status={evaluation.status ?? "pending"} />
                                                                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium text-amber-900">
                                                                            Urgency: {urgency}
                                                                        </span>
                                                                    </div>

                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                        <span className="font-medium">Preferred:</span> {preferred}
                                                                    </p>
                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                        <span className="font-medium">Final:</span> {finalSchedule}
                                                                    </p>

                                                                    {evaluation.details ? (
                                                                        <p className="mt-1 text-[0.7rem] text-slate-700">
                                                                            <span className="font-medium">Details:</span>{" "}
                                                                            {String(evaluation.details).length > 160
                                                                                ? `${String(evaluation.details).slice(0, 160)}…`
                                                                                : String(evaluation.details)}
                                                                        </p>
                                                                    ) : null}
                                                                </div>

                                                                <div className="flex flex-col items-start gap-2 text-[0.7rem] text-muted-foreground sm:items-end">
                                                                    <p>
                                                                        Requested on:{" "}
                                                                        <span className="font-medium">
                                                                            {formatDateDisplay(evaluation.created_at)}
                                                                        </span>
                                                                    </p>

                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                                        onClick={() => openRequestPreview(evaluation)}
                                                                    >
                                                                        View / Preview
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>

                                        {/* Past */}
                                        <section className="space-y-2">
                                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                                <h2 className="text-xs font-semibold text-amber-900">Past requests</h2>
                                                <p className="text-[0.7rem] text-muted-foreground">
                                                    Older requests and sessions are kept here for reference.
                                                </p>
                                            </div>

                                            {pastEvaluations.length === 0 ? (
                                                <p className="text-[0.7rem] text-muted-foreground">
                                                    You don’t have any past requests yet.
                                                </p>
                                            ) : (
                                                <div className="space-y-2 text-xs">
                                                    {pastEvaluations.map((evaluation) => {
                                                        const concern = formatConcernType(evaluation.concern_type ?? undefined);
                                                        const urgency = formatUrgency(evaluation.urgency ?? undefined);
                                                        const preferred = formatPreferredDateTime(evaluation);
                                                        const finalSchedule = formatFinalDateTime(evaluation as any);

                                                        return (
                                                            <div
                                                                key={evaluation.id}
                                                                className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                                                            >
                                                                <div className="space-y-0.5">
                                                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                                                        <p className="font-medium text-slate-900">
                                                                            {concern || "Counseling request"}
                                                                        </p>
                                                                        <StatusBadge status={evaluation.status ?? "pending"} />
                                                                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium text-slate-900">
                                                                            Urgency: {urgency}
                                                                        </span>
                                                                    </div>

                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                        <span className="font-medium">Preferred:</span> {preferred}
                                                                    </p>
                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                        <span className="font-medium">Final:</span> {finalSchedule}
                                                                    </p>

                                                                    {evaluation.details ? (
                                                                        <p className="mt-1 text-[0.7rem] text-slate-700">
                                                                            <span className="font-medium">Details:</span>{" "}
                                                                            {String(evaluation.details).length > 160
                                                                                ? `${String(evaluation.details).slice(0, 160)}…`
                                                                                : String(evaluation.details)}
                                                                        </p>
                                                                    ) : null}
                                                                </div>

                                                                <div className="flex flex-col items-start gap-2 text-[0.7rem] text-muted-foreground sm:items-end">
                                                                    <p>
                                                                        Requested on:{" "}
                                                                        <span className="font-medium">
                                                                            {formatDateDisplay(evaluation.created_at)}
                                                                        </span>
                                                                    </p>

                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 border-slate-200 bg-white/80 text-[0.7rem] text-slate-900 hover:bg-slate-50"
                                                                        onClick={() => openRequestPreview(evaluation)}
                                                                    >
                                                                        View / Preview
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>
                                    </section>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                {/* ✅ Mobile-only: proper viewport spacing (top/bottom/left/right). Desktop unchanged via sm:* */}
                <DialogContent
                    className={[
                        // left/right spacing: 1rem each side (100vw - 2rem)
                        "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)]",
                        // top/bottom spacing: pin near top with 1rem gap and limit height
                        "top-4 translate-y-0 max-h-[calc(100vh-2rem)]",
                        // keep desktop behavior untouched
                        "sm:max-w-3xl sm:top-[50%] sm:translate-y-[-50%] sm:max-h-none",
                    ].join(" ")}
                >
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                            {dialogTitle}
                        </DialogTitle>
                        <DialogDescription className="text-xs">{dialogSubtitle}</DialogDescription>
                    </DialogHeader>

                    {/* ✅ Mobile-only max height uses viewport; desktop keeps original 70vh */}
                    <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-2 sm:max-h-[70vh]">
                        {dialogMode === "assessment" ? (
                            selectedAssessment ? (
                                <div className="space-y-4 text-sm">
                                    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
                                        <div className="space-y-1 text-xs">
                                            <p>
                                                <span className="font-medium">Consent:</span>{" "}
                                                {(selectedAssessment as any).consent ? "Yes" : "No"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Age:</span>{" "}
                                                {typeof (selectedAssessment as any).age === "number"
                                                    ? (selectedAssessment as any).age
                                                    : "—"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Gender:</span>{" "}
                                                {formatGender((selectedAssessment as any).gender)}
                                            </p>
                                            <p>
                                                <span className="font-medium">Occupation:</span>{" "}
                                                {(selectedAssessment as any).occupation?.trim?.()
                                                    ? (selectedAssessment as any).occupation.trim()
                                                    : "—"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Living situation:</span>{" "}
                                                {formatLivingSituation(
                                                    (selectedAssessment as any).living_situation,
                                                    (selectedAssessment as any).living_situation_other,
                                                )}
                                            </p>
                                        </div>

                                        <div className="space-y-1 text-xs">
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                This is a read-only preview of your submitted intake assessment.
                                            </p>
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                If you need corrections, please contact the Guidance &amp; Counseling
                                                Office.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-amber-900">
                                            Questionnaire responses (preview)
                                        </p>

                                        {getAssessmentHasAnyResponses(selectedAssessment as any) ? (
                                            <div className="overflow-x-auto rounded-md border">
                                                <div className="min-w-[640px]">
                                                    <div className="grid grid-cols-[1fr_220px] bg-muted/50 px-3 py-2 text-[0.7rem] font-medium">
                                                        <div>Question</div>
                                                        <div className="text-right">Answer</div>
                                                    </div>

                                                    <div className="divide-y">
                                                        {MH_KEYS.map((key) => (
                                                            <div
                                                                key={String(key)}
                                                                className="grid grid-cols-[1fr_220px] gap-3 px-3 py-2 text-[0.75rem]"
                                                            >
                                                                <div className="text-muted-foreground">{MH_QUESTIONS[key]}</div>
                                                                <div className="text-right font-medium text-amber-900">
                                                                    {prettyFrequency((selectedAssessment as any)[key] ?? null)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                                                No item-by-item questionnaire fields were found to preview for this
                                                submission.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-6 text-center text-xs text-muted-foreground">
                                    No assessment selected.
                                </div>
                            )
                        ) : selectedRequest ? (
                            <div className="space-y-4 text-sm">
                                <div className="rounded-md border bg-muted/30 p-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-amber-900">
                                                    {formatConcernType(selectedRequest.concern_type ?? undefined)}
                                                </p>
                                                <StatusBadge status={selectedRequest.status ?? "pending"} />
                                                <span className="rounded-md bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium text-amber-900">
                                                    Urgency: {formatUrgency(selectedRequest.urgency ?? undefined)}
                                                </span>
                                            </div>

                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-medium">Requested:</span>{" "}
                                                {formatDateTime(selectedRequest.created_at)}
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-medium">Preferred schedule:</span>{" "}
                                                {formatPreferredDateTime(selectedRequest)}
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-medium">Final schedule:</span>{" "}
                                                {formatFinalDateTime(selectedRequest as any)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-amber-900">Request details</p>
                                    <div className="rounded-md border bg-white/70 p-3 text-xs text-slate-800">
                                        {selectedRequest.details ? (
                                            <p className="whitespace-pre-wrap">{String(selectedRequest.details)}</p>
                                        ) : (
                                            <p className="text-muted-foreground">No details provided.</p>
                                        )}
                                    </div>

                                    <div className="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-[0.7rem] text-amber-900">
                                        This is a read-only preview. If you need changes, please contact the
                                        Guidance &amp; Counseling Office or submit a new request (if your workflow
                                        allows).
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No request selected.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeDialog}
                            className="w-full sm:w-auto"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};

export default StudentEvaluation;
