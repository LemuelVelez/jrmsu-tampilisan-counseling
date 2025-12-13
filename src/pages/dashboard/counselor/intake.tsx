/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
    AlertCircle,
    ClipboardList as ClipboardListIcon,
    FileDown,
    Loader2,
    UserCircle2,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import { jsPDF } from "jspdf";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeAssessmentDto, MentalFrequencyApi } from "@/api/intake/route";

const FREQUENCY_SCORES: Record<MentalFrequencyApi, number> = {
    not_at_all: 0,
    several_days: 1,
    more_than_half: 2,
    nearly_every_day: 3,
};

const MENTAL_FREQUENCY_LABELS: Record<MentalFrequencyApi, string> = {
    not_at_all: "Not at all",
    several_days: "Several days",
    more_than_half: "More than half the days",
    nearly_every_day: "Nearly every day",
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

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
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

        const error = new Error(message) as Error & {
            status?: number;
            data?: unknown;
        };
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

function prettyFrequency(value?: MentalFrequencyApi | null): string {
    if (!value) return "—";
    return MENTAL_FREQUENCY_LABELS[value] ?? String(value);
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
}

function downloadAssessmentPdf(assessment: IntakeAssessmentDto): void {
    try {
        const studentName = getStudentDisplayName(assessment);
        const submitted = formatDateTime(assessment.created_at);
        const { score, answered } = calculatePhqScore(assessment);
        const severity = phqSeverityLabel(score);

        const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const margin = 32;

        const COLORS = {
            ink: [17, 24, 39] as [number, number, number],
            muted: [75, 85, 99] as [number, number, number],
            border: [229, 231, 235] as [number, number, number],
            header: [245, 158, 11] as [number, number, number],
            headerText: [255, 255, 255] as [number, number, number],
            soft: [249, 250, 251] as [number, number, number],
            zebra: [255, 251, 235] as [number, number, number],
            brand: [180, 83, 9] as [number, number, number],
            brandLight: [255, 247, 237] as [number, number, number],
        };

        const cursor = { y: 0 };

        const wrapMaxLines = (text: string, maxWidth: number, maxLines: number) => {
            const lines = doc.splitTextToSize(text, maxWidth) as string[];
            if (lines.length <= maxLines) return lines;

            const truncated = lines.slice(0, maxLines);
            const last = truncated[maxLines - 1] ?? "";
            const ellipsis = "…";

            let out = last;
            while (out.length > 0 && doc.getTextWidth(out + ellipsis) > maxWidth) {
                out = out.slice(0, -1);
            }
            truncated[maxLines - 1] = (out || last).trimEnd() + ellipsis;
            return truncated;
        };

        // Header
        const headerH = 46;
        doc.setFillColor(...COLORS.header);
        doc.rect(0, 0, pageWidth, headerH, "F");

        doc.setTextColor(...COLORS.headerText);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("JRMSU Guidance & Counseling Office", margin, 22);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Mental health needs assessment (Steps 1–3)", margin, 38);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("CONFIDENTIAL", pageWidth - margin, 22, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
            `Generated: ${format(new Date(), "MMM d, yyyy – h:mm a")}`,
            pageWidth - margin,
            38,
            { align: "right" },
        );

        doc.setTextColor(...COLORS.ink);
        cursor.y = headerH + 16;

        const sectionTitle = (title: string) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.brand);
            doc.text(title.toUpperCase(), margin, cursor.y);
            cursor.y += 10;

            doc.setDrawColor(...COLORS.border);
            doc.line(margin, cursor.y, pageWidth - margin, cursor.y);
            cursor.y += 10;

            doc.setTextColor(...COLORS.ink);
        };

        const cardW = pageWidth - margin * 2;

        const drawCard = (y: number, h: number) => {
            doc.setFillColor(...COLORS.soft);
            doc.setDrawColor(...COLORS.border);
            doc.roundedRect(margin, y, cardW, h, 8, 8, "FD");
        };

        const kv = (label: string, value: string, x: number, y: number) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.muted);
            doc.text(label, x, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.ink);
            const lines = wrapMaxLines(
                value,
                (pageWidth - margin * 2) / 2 - 26,
                2,
            );
            doc.text(lines, x, y + 12);
        };

        // Student info
        sectionTitle("Student information");

        const studentCardY = cursor.y;
        const studentCardH = 72;
        drawCard(studentCardY, studentCardH);

        const leftX = margin + 14;
        const rightX = margin + cardW / 2 + 6;
        const topY = studentCardY + 16;

        kv("Student", studentName, leftX, topY);
        kv("Submitted", submitted, rightX, topY);

        kv(
            "Consent",
            assessment.consent ? "Yes (consented)" : "No consent on record",
            leftX,
            topY + 34,
        );
        kv("Score", `${score} / 27  ·  ${answered} of 9 answered`, rightX, topY + 34);

        // Severity pill
        const badgeText = `Severity: ${severity}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const badgeW = doc.getTextWidth(badgeText) + 16;
        const badgeH = 16;

        const badgeX = margin + cardW - badgeW - 14;
        const badgeY = studentCardY + 10;

        doc.setFillColor(...COLORS.brand);
        doc.setTextColor(...COLORS.headerText);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 8, 8, "F");
        doc.text(badgeText, badgeX + 8, badgeY + 11);

        doc.setTextColor(...COLORS.ink);
        cursor.y = studentCardY + studentCardH + 14;

        // Demographics
        sectionTitle("Demographic snapshot");

        const demoCardY = cursor.y;
        const demoCardH = 70;
        drawCard(demoCardY, demoCardH);

        const demoY = demoCardY + 16;

        const ageVal = typeof assessment.age === "number" ? String(assessment.age) : "—";
        const genderVal = formatGender(assessment.gender ?? undefined);
        const occupationVal = assessment.occupation?.trim() || "—";
        const livingVal = formatLivingSituation(
            assessment.living_situation ?? undefined,
            assessment.living_situation_other ?? undefined,
        );

        kv("Age", ageVal, leftX, demoY);
        kv("Gender", genderVal, rightX, demoY);
        kv("Occupation", occupationVal, leftX, demoY + 34);
        kv("Living situation", livingVal, rightX, demoY + 34);

        cursor.y = demoCardY + demoCardH + 14;

        // Responses
        sectionTitle("Questionnaire responses");

        const tableLeft = margin;
        const tableWidth = pageWidth - margin * 2;

        const colAnswerW = 160;
        const colQuestionW = tableWidth - colAnswerW;

        const th = 22;
        doc.setFillColor(...COLORS.header);
        doc.roundedRect(tableLeft, cursor.y, tableWidth, th, 8, 8, "F");
        doc.setTextColor(...COLORS.headerText);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Question", tableLeft + 12, cursor.y + 15);
        doc.text("Answer", tableLeft + tableWidth - 12, cursor.y + 15, { align: "right" });
        doc.setTextColor(...COLORS.ink);

        cursor.y += th;

        const rowH = 30;
        const padX = 12;

        for (let i = 0; i < MH_KEYS.length; i += 1) {
            const key = MH_KEYS[i];
            const q = MH_QUESTIONS[key];
            const a = prettyFrequency(assessment[key] as MentalFrequencyApi | null | undefined);

            if (i % 2 === 0) {
                doc.setFillColor(...COLORS.zebra);
                doc.rect(tableLeft, cursor.y, tableWidth, rowH, "F");
            }

            doc.setDrawColor(...COLORS.border);
            doc.rect(tableLeft, cursor.y, tableWidth, rowH, "S");
            doc.line(tableLeft + colQuestionW, cursor.y, tableLeft + colQuestionW, cursor.y + rowH);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.6);
            doc.setTextColor(...COLORS.muted);
            const qLines = wrapMaxLines(q, colQuestionW - padX * 2, 2);
            doc.text(qLines, tableLeft + padX, cursor.y + 12);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.ink);
            doc.text(a, tableLeft + tableWidth - padX, cursor.y + 18, { align: "right" });

            cursor.y += rowH;
        }

        cursor.y += 10;

        const noteH = 44;
        doc.setFillColor(...COLORS.brandLight);
        doc.setDrawColor(...COLORS.border);
        doc.roundedRect(margin, cursor.y, cardW, noteH, 8, 8, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.brand);
        doc.text("Important note", margin + 12, cursor.y + 16);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        const note =
            "PHQ-9 style scoring for triage only; not a diagnosis. Handle as confidential.";
        doc.text(wrapMaxLines(note, cardW - 24, 2), margin + 12, cursor.y + 30);

        doc.setDrawColor(...COLORS.border);
        doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text("JRMSU Guidance & Counseling Office • Confidential", margin, pageHeight - 18);
        doc.text("Page 1 of 1", pageWidth - margin, pageHeight - 18, { align: "right" });

        const fileName = sanitizeFilename(
            `assessment-${studentName}-${(assessment.created_at ?? "submitted").toString().slice(0, 10)}.pdf`,
        );

        doc.save(fileName);
    } catch {
        toast.error("Failed to generate PDF. Please try again.");
    }
}

const CounselorIntake: React.FC = () => {
    const [assessments, setAssessments] = React.useState<IntakeAssessmentDto[]>([]);
    const [isLoadingAssessments, setIsLoadingAssessments] = React.useState(false);
    const [assessmentsError, setAssessmentsError] = React.useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedAssessment, setSelectedAssessment] =
        React.useState<IntakeAssessmentDto | null>(null);

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

    const closeAssessmentDialog = () => {
        setIsDialogOpen(false);
        setSelectedAssessment(null);
    };

    const dialogStudentName = selectedAssessment
        ? getStudentDisplayName(selectedAssessment)
        : "Assessment";
    const dialogSubmitted = selectedAssessment ? formatDateTime(selectedAssessment.created_at) : "—";

    const dialogScore = selectedAssessment
        ? calculatePhqScore(selectedAssessment)
        : { score: 0, answered: 0 };
    const dialogSeverity = selectedAssessment ? phqSeverityLabel(dialogScore.score) : "—";

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

                        {/* ✅ Mobile: vertical buttons, Desktop: unchanged */}
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void reloadAssessments()}
                                className="w-full border-amber-200 bg-white/80 text-xs text-amber-900 hover:bg-amber-50 sm:w-auto"
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

                            <Button asChild type="button" size="sm" className="w-full text-xs sm:w-auto">
                                <Link to="/dashboard/counselor/appointments">Open Appointments</Link>
                            </Button>
                        </div>
                    </div>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                Needs assessments (Steps 1–3)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This list shows consent, demographic snapshots, and mental health questionnaire responses
                                submitted by students. Scores are shown for triage and{" "}
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

                                                <div className="mt-1 flex flex-col items-start gap-2 text-[0.7rem] text-muted-foreground sm:items-end">
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

                                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 border-amber-200 bg-white/80 text-[0.7rem] text-amber-900 hover:bg-amber-50"
                                                            onClick={() => {
                                                                setSelectedAssessment(assessment);
                                                                setIsDialogOpen(true);
                                                            }}
                                                        >
                                                            View / Download
                                                        </Button>
                                                    </div>
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Assessment – {dialogStudentName}</DialogTitle>
                        <DialogDescription className="text-xs">Submitted: {dialogSubmitted}</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                        {selectedAssessment ? (
                            <div className="space-y-4 text-sm">
                                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
                                    <div className="space-y-1 text-xs">
                                        <p>
                                            <span className="font-medium">Consent:</span>{" "}
                                            {selectedAssessment.consent ? "Yes" : "No"}
                                        </p>
                                        <p>
                                            <span className="font-medium">Age:</span>{" "}
                                            {typeof selectedAssessment.age === "number" ? selectedAssessment.age : "—"}
                                        </p>
                                        <p>
                                            <span className="font-medium">Gender:</span>{" "}
                                            {formatGender(selectedAssessment.gender ?? undefined)}
                                        </p>
                                        <p>
                                            <span className="font-medium">Occupation:</span>{" "}
                                            {selectedAssessment.occupation?.trim() || "—"}
                                        </p>
                                        <p>
                                            <span className="font-medium">Living situation:</span>{" "}
                                            {formatLivingSituation(
                                                selectedAssessment.living_situation ?? undefined,
                                                selectedAssessment.living_situation_other ?? undefined,
                                            )}
                                        </p>
                                    </div>

                                    <div className="space-y-1 text-xs">
                                        <p>
                                            <span className="font-medium">Score:</span>{" "}
                                            <span className="font-semibold">{dialogScore.score}</span>{" "}
                                            <span className="text-muted-foreground">
                                                ({dialogScore.answered} of 9 answered)
                                            </span>
                                        </p>
                                        <p>
                                            <span className="font-medium">Severity band:</span>{" "}
                                            <span className="font-semibold">{dialogSeverity}</span>
                                        </p>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            Based on PHQ-9 style scoring for triage only; not a diagnosis or clinical label.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-amber-900">Item-by-item responses</p>

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
                                                            {prettyFrequency(
                                                                selectedAssessment[key] as MentalFrequencyApi | null | undefined,
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No assessment selected.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeAssessmentDialog}
                            className="w-full sm:w-auto"
                        >
                            Close
                        </Button>

                        <Button
                            type="button"
                            onClick={() => {
                                if (!selectedAssessment) return;
                                downloadAssessmentPdf(selectedAssessment);
                            }}
                            disabled={!selectedAssessment}
                            className="w-full sm:w-auto"
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
};

export default CounselorIntake;
