/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AlertCircle, ClipboardList as ClipboardListIcon, Loader2, UserCircle2 } from "lucide-react";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeAssessmentDto, MentalFrequencyApi } from "@/api/intake/route";

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
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorIntakeFetch<T>(path: string): Promise<T> {
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

async function fetchAssessments(): Promise<IntakeAssessmentDto[]> {
    const raw = await counselorIntakeFetch<any>("/counselor/intake/assessments");

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

function formatGender(raw?: string | null): string {
    if (!raw) return "—";
    const v = raw.toLowerCase();
    if (v.startsWith("m")) return "Male";
    if (v.startsWith("f")) return "Female";
    if (v === "non_binary_other" || v.includes("non") || v.includes("other")) {
        return "Non-binary / Other";
    }
    return raw;
}

function formatLivingSituation(raw?: string | null, other?: string | null): string {
    if (!raw) return "—";
    const v = raw.toLowerCase();
    if (v === "alone") return "Alone";
    if (v === "with_family") return "With family";
    if (v === "with_friends") return "With friends";
    if (v === "other") {
        return other?.trim() ? `Other – ${other.trim()}` : "Other";
    }
    return raw;
}

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

const CounselorIntake: React.FC = () => {
    const [assessments, setAssessments] = React.useState<IntakeAssessmentDto[]>([]);
    const [isLoadingAssessments, setIsLoadingAssessments] = React.useState(false);
    const [assessmentsError, setAssessmentsError] = React.useState<string | null>(null);

    const reloadAssessments = React.useCallback(async () => {
        setIsLoadingAssessments(true);
        setAssessmentsError(null);

        try {
            const items = await fetchAssessments();
            const sorted = [...items].sort((a, b) => {
                const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
                const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
                return bCreated - aCreated;
            });
            setAssessments(sorted);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to load assessment submissions.";
            setAssessmentsError(message);
            toast.error(message);
        } finally {
            setIsLoadingAssessments(false);
        }
    }, []);

    React.useEffect(() => {
        void reloadAssessments();
    }, [reloadAssessments]);

    return (
        <DashboardLayout
            title="Intake"
            description="Review mental health needs assessment submissions (Steps 1–3). Counseling requests are managed in Appointments."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-5xl space-y-4">
                    {/* Top controls */}
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-amber-900">
                            <p className="font-semibold">Guidance &amp; Counseling – Intake (Assessments)</p>
                            <p className="text-[0.7rem] text-amber-900/80">
                                Counseling requests are now handled as{" "}
                                <span className="font-medium">appointments</span>. Go to{" "}
                                <Link to="/dashboard/counselor/appointments" className="font-semibold underline">
                                    Appointments
                                </Link>{" "}
                                to schedule or reschedule.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void reloadAssessments()}
                                className="border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50"
                            >
                                {isLoadingAssessments ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Refreshing…
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5" />
                                        Refresh
                                    </>
                                )}
                            </Button>

                            <Button asChild type="button" size="sm" className="text-xs">
                                <Link to="/dashboard/counselor/appointments">Open Appointments</Link>
                            </Button>
                        </div>
                    </div>

                    {/* ASSESSMENTS */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                Needs assessments (Steps 1–3)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This list shows consent, demographic snapshots, and mental health questionnaire
                                responses submitted by students. Scores are shown for triage and{" "}
                                <span className="font-medium">are not diagnostic labels</span>.
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {assessmentsError && (
                                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-800">
                                    <AlertCircle className="mt-px h-3.5 w-3.5" />
                                    <div>
                                        <p className="font-medium">Unable to load assessment submissions.</p>
                                        <p className="text-[0.7rem] opacity-90">{assessmentsError}</p>
                                    </div>
                                </div>
                            )}

                            {isLoadingAssessments && !assessments.length ? (
                                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading assessment submissions…
                                </div>
                            ) : null}

                            {!isLoadingAssessments && assessments.length === 0 && !assessmentsError && (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                    No assessment submissions have been recorded yet.
                                    <br />
                                    Once students submit the intake assessment, they will appear here.
                                </div>
                            )}

                            {!isLoadingAssessments && assessments.length > 0 && (
                                <div className="space-y-2">
                                    {assessments.map((assessment) => {
                                        const studentName = getStudentDisplayName(assessment);
                                        const created = formatDateTime(assessment.created_at);
                                        const { score, answered } = calculatePhqScore(assessment);
                                        const severity = phqSeverityLabel(score);
                                        const hasConsent = assessment.consent === true;

                                        return (
                                            <div
                                                key={assessment.id}
                                                className="flex flex-col gap-2 rounded-md border border-amber-50 bg-amber-50/40 px-3 py-2.5 text-xs sm:flex-row sm:items-start sm:justify-between"
                                            >
                                                {/* Left – student + demographics */}
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[0.8rem] font-semibold text-amber-900">
                                                        <UserCircle2 className="h-3.5 w-3.5 text-amber-700" />
                                                        <span>{studentName}</span>
                                                        {hasConsent ? (
                                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-800">
                                                                Consent given
                                                            </span>
                                                        ) : (
                                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-medium text-red-800">
                                                                No consent on record
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
                                                        <span>
                                                            <span className="font-medium">Age:</span>{" "}
                                                            {typeof assessment.age === "number" ? assessment.age : "—"}
                                                        </span>
                                                        <span>
                                                            <span className="font-medium">Gender:</span>{" "}
                                                            {formatGender(assessment.gender ?? undefined)}
                                                        </span>
                                                        <span>
                                                            <span className="font-medium">Occupation:</span>{" "}
                                                            {assessment.occupation?.trim() || "—"}
                                                        </span>
                                                        <span>
                                                            <span className="font-medium">Living situation:</span>{" "}
                                                            {formatLivingSituation(
                                                                assessment.living_situation ?? undefined,
                                                                assessment.living_situation_other ?? undefined,
                                                            )}
                                                        </span>
                                                    </div>

                                                    <p className="text-[0.65rem] text-muted-foreground">Submitted: {created}</p>
                                                </div>

                                                {/* Right – MH summary */}
                                                <div className="mt-1 flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:items-end">
                                                    <div className="rounded-md bg-white/90 px-3 py-1.5 shadow-inner shadow-amber-50/70">
                                                        <p className="text-[0.7rem] font-semibold text-amber-900">
                                                            Questionnaire summary
                                                        </p>
                                                        <p className="text-[0.7rem] text-amber-900">
                                                            Score: <span className="font-semibold">{score}</span>{" "}
                                                            <span className="text-[0.65rem] text-muted-foreground">
                                                                ({answered} of 9 answered)
                                                            </span>
                                                        </p>
                                                        <p className="text-[0.7rem] text-amber-900">
                                                            Severity band: <span className="font-semibold">{severity}</span>
                                                        </p>
                                                        <p className="mt-1 text-[0.6rem] text-muted-foreground">
                                                            Based on PHQ-9 style scoring for{" "}
                                                            <span className="font-medium">triage only</span>; not a diagnosis or
                                                            clinical label.
                                                        </p>
                                                    </div>

                                                    <p className="max-w-xs text-[0.65rem] text-muted-foreground sm:text-right">
                                                        For full item-by-item responses, please refer to the student’s detailed
                                                        record in the Evaluation or Student profile view.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default CounselorIntake;
