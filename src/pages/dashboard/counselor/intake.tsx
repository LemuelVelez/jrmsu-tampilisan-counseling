/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
    AlertCircle,
    BarChart3,
    ClipboardList as ClipboardListIcon,
    FileDown,
    Loader2,
    ShieldAlert,
    Trash2,
    UserCircle2,
} from "lucide-react";

import { jsPDF } from "jspdf";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeAssessmentDto, MentalFrequencyApi } from "@/api/intake/route";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";

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

type ReportRangePreset = "all" | "7d" | "30d" | "90d";
type ReportConsentFilter = "all" | "consented" | "no_consent";

// ✅ Shared runtime + typing source (fixes eslint "only used as type")
const SEVERITY_BANDS = ["Minimal", "Mild", "Moderate", "Moderately severe", "Severe"] as const;
type SeverityBand = (typeof SEVERITY_BANDS)[number];

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }
    const trimmed = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmed}`;
}

async function counselorIntakeApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

        const error = new Error(message) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

async function fetchAssessments(): Promise<IntakeAssessmentDto[]> {
    const raw = await counselorIntakeApiFetch<any>("/counselor/intake/assessments", {
        method: "GET",
    });

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

async function deleteAssessment(assessmentId: number | string): Promise<any> {
    const candidates = [
        `/counselor/intake/assessments/${assessmentId}`,
        `/counselor/assessments/${assessmentId}`,
        `/counselor/intake/assessment/${assessmentId}`,
    ];

    let lastErr: unknown = null;
    for (const path of candidates) {
        try {
            return await counselorIntakeApiFetch<any>(path, { method: "DELETE" });
        } catch (err) {
            const e = err as any;
            lastErr = err;
            if (e?.status === 404) continue;
            throw err;
        }
    }

    throw lastErr ?? new Error("Delete endpoint not found.");
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

function phqSeverityLabel(score: number): SeverityBand {
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

function severityBadgeClass(severity: string): string {
    switch (severity) {
        case "Minimal":
            return "border-emerald-200 bg-emerald-50 text-emerald-800";
        case "Mild":
            return "border-sky-200 bg-sky-50 text-sky-800";
        case "Moderate":
            return "border-amber-200 bg-amber-50 text-amber-900";
        case "Moderately severe":
            return "border-orange-200 bg-orange-50 text-orange-900";
        case "Severe":
            return "border-red-200 bg-red-50 text-red-700";
        default:
            return "border-border bg-muted text-foreground";
    }
}

function rangeLabel(preset: ReportRangePreset): string {
    if (preset === "all") return "All time";
    if (preset === "7d") return "Last 7 days";
    if (preset === "30d") return "Last 30 days";
    return "Last 90 days";
}

function presetStartMs(preset: ReportRangePreset): number | null {
    if (preset === "all") return null;
    const now = Date.now();
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    return now - days * 24 * 60 * 60 * 1000;
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
        doc.text(`Generated: ${format(new Date(), "MMM d, yyyy – h:mm a")}`, pageWidth - margin, 38, {
            align: "right",
        });

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
            const lines = wrapMaxLines(value, (pageWidth - margin * 2) / 2 - 26, 2);
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

function downloadAssessmentReportPdf(
    items: IntakeAssessmentDto[],
    opts: { preset: ReportRangePreset; consent: ReportConsentFilter; search: string },
): void {
    try {
        const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const margin = 32;
        const maxW = pageWidth - margin * 2;

        const title = "Assessment Report (Score/Statistics-Based)";
        const subtitle = `Range: ${rangeLabel(opts.preset)} • Consent: ${opts.consent === "all"
                ? "All"
                : opts.consent === "consented"
                    ? "Consented only"
                    : "No consent only"
            }${opts.search.trim() ? ` • Search: "${opts.search.trim()}"` : ""}`;

        // Summary stats
        const scores = items.map((a) => calculatePhqScore(a).score);
        const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0;

        const severityCounts = SEVERITY_BANDS.reduce((acc, sev) => {
            acc[sev] = 0;
            return acc;
        }, {} as Record<SeverityBand, number>);

        for (const a of items) {
            const sc = calculatePhqScore(a).score;
            const sev = phqSeverityLabel(sc);
            severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
        }

        const consented = items.filter((a) => a.consent === true).length;
        const noConsent = items.length - consented;

        const flagged = items.filter((a) => {
            const v = a.mh_self_harm as MentalFrequencyApi | null | undefined;
            return v === "more_than_half" || v === "nearly_every_day";
        });

        // Header
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 0, pageWidth, 54, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("JRMSU Guidance & Counseling Office", margin, 22);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Confidential • Internal Counselor Report", margin, 40);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`Generated: ${format(new Date(), "MMM d, yyyy – h:mm a")}`, pageWidth - margin, 22, {
            align: "right",
        });

        // Body
        let y = 78;

        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(title, margin, y);
        y += 18;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const subtitleLines = doc.splitTextToSize(subtitle, maxW);
        doc.text(subtitleLines, margin, y);
        y += subtitleLines.length * 12 + 10;

        // Summary block
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(margin, y, maxW, 92, 10, 10, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(180, 83, 9);
        doc.text("Summary", margin + 14, y + 20);

        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        const leftX = margin + 14;
        const rightX = margin + maxW / 2 + 8;
        doc.text(`Total submissions: ${items.length}`, leftX, y + 40);
        doc.text(`Average score: ${avg.toFixed(1)} / 27`, rightX, y + 40);

        doc.text(`Consented: ${consented}`, leftX, y + 58);
        doc.text(`No consent: ${noConsent}`, rightX, y + 58);

        doc.text(`Self-harm high-frequency flags: ${flagged.length}`, leftX, y + 76);

        y += 108;

        // Severity distribution
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(180, 83, 9);
        doc.text("Severity distribution", margin, y);
        y += 10;

        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(17, 24, 39);

        for (const sev of SEVERITY_BANDS) {
            const count = severityCounts[sev] ?? 0;
            const pct = items.length ? Math.round((count / items.length) * 100) : 0;
            doc.text(`${sev}: ${count} (${pct}%)`, margin, y);
            y += 14;
        }

        y += 6;

        // Flagged list (short)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(180, 83, 9);
        doc.text("Flagged for immediate attention (self-harm item)", margin, y);
        y += 10;

        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(17, 24, 39);

        if (flagged.length === 0) {
            doc.text("None in the selected range.", margin, y);
            y += 14;
        } else {
            const take = flagged.slice(0, 10);
            for (const a of take) {
                const name = getStudentDisplayName(a);
                const created = formatDateTime(a.created_at);
                const v = prettyFrequency(a.mh_self_harm as MentalFrequencyApi | null | undefined);
                doc.text(`• ${name} — ${created} — Self-harm: ${v}`, margin, y);
                y += 14;
                if (y > pageHeight - 60) break;
            }
            if (flagged.length > take.length && y <= pageHeight - 40) {
                doc.setTextColor(75, 85, 99);
                doc.text(`(+${flagged.length - take.length} more not shown)`, margin, y);
                y += 14;
            }
        }

        // Footer note
        doc.setTextColor(75, 85, 99);
        doc.setFontSize(8);
        doc.text(
            "PHQ-9 style scoring for triage only; not a diagnosis. Treat student data as confidential.",
            margin,
            pageHeight - 22,
        );

        const fileName = sanitizeFilename(
            `assessment-report-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        );
        doc.save(fileName);
    } catch {
        toast.error("Failed to generate report PDF. Please try again.");
    }
}

const CounselorIntake: React.FC = () => {
    const [assessments, setAssessments] = React.useState<IntakeAssessmentDto[]>([]);
    const [isLoadingAssessments, setIsLoadingAssessments] = React.useState(false);
    const [assessmentsError, setAssessmentsError] = React.useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedAssessment, setSelectedAssessment] =
        React.useState<IntakeAssessmentDto | null>(null);

    // Delete confirmation
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<IntakeAssessmentDto | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // ✅ Report filters
    const [reportRange, setReportRange] = React.useState<ReportRangePreset>("30d");
    const [reportConsent, setReportConsent] = React.useState<ReportConsentFilter>("all");
    const [reportSearch, setReportSearch] = React.useState("");

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

    const openAssessmentDialog = (assessment: IntakeAssessmentDto) => {
        setSelectedAssessment(assessment);
        setIsDialogOpen(true);
    };

    const askDelete = (assessment: IntakeAssessmentDto) => {
        setDeleteTarget(assessment);
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        try {
            await deleteAssessment(deleteTarget.id);
            toast.success("Assessment deleted.");
            setDeleteOpen(false);
            setDeleteTarget(null);
            void reloadAssessments();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete assessment.";
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const dialogStudentName = selectedAssessment
        ? getStudentDisplayName(selectedAssessment)
        : "Assessment";
    const dialogSubmitted = selectedAssessment ? formatDateTime(selectedAssessment.created_at) : "—";

    const dialogScore = selectedAssessment
        ? calculatePhqScore(selectedAssessment)
        : { score: 0, answered: 0 };
    const dialogSeverity = selectedAssessment ? phqSeverityLabel(dialogScore.score) : "—";

    const reportFiltered = React.useMemo(() => {
        const startMs = presetStartMs(reportRange);

        const q = reportSearch.trim().toLowerCase();

        return assessments.filter((a) => {
            // date range
            if (startMs != null) {
                const t = a.created_at ? Date.parse(a.created_at) : NaN;
                if (!Number.isNaN(t) && t < startMs) return false;
            }

            // consent filter
            if (reportConsent === "consented" && a.consent !== true) return false;
            if (reportConsent === "no_consent" && a.consent === true) return false;

            // search
            if (q) {
                const name = getStudentDisplayName(a).toLowerCase();
                const uid = String(a.user_id ?? "").toLowerCase();
                const sid = String((a as any)?.student_id ?? "").toLowerCase();
                if (!name.includes(q) && !uid.includes(q) && !sid.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [assessments, reportRange, reportConsent, reportSearch]);

    const reportStats = React.useMemo(() => {
        const total = reportFiltered.length;

        const uniqueStudents = new Set<string>();
        let consented = 0;

        const scoreRows = reportFiltered.map((a) => {
            const { score, answered } = calculatePhqScore(a);
            uniqueStudents.add(String(a.user_id ?? a.id));
            if (a.consent === true) consented += 1;

            const severity = phqSeverityLabel(score);

            const selfHarm = a.mh_self_harm as MentalFrequencyApi | null | undefined;
            const isFlagged =
                selfHarm === "more_than_half" || selfHarm === "nearly_every_day";

            return {
                assessment: a,
                score,
                answered,
                severity,
                isFlagged,
            };
        });

        const averageScore =
            scoreRows.length > 0
                ? scoreRows.reduce((sum, r) => sum + r.score, 0) / scoreRows.length
                : 0;

        const answeredAvg =
            scoreRows.length > 0
                ? scoreRows.reduce((sum, r) => sum + r.answered, 0) / scoreRows.length
                : 0;

        const severityCounts: Record<SeverityBand, number> = {
            Minimal: 0,
            Mild: 0,
            Moderate: 0,
            "Moderately severe": 0,
            Severe: 0,
        };

        for (const r of scoreRows) {
            const k = r.severity as SeverityBand;
            if (k in severityCounts) severityCounts[k] += 1;
        }

        const flagged = scoreRows.filter((r) => r.isFlagged);

        // Item stats
        const itemStats = MH_KEYS.map((key) => {
            const counts: Record<MentalFrequencyApi, number> = {
                not_at_all: 0,
                several_days: 0,
                more_than_half: 0,
                nearly_every_day: 0,
            };

            let answered = 0;
            let sumScore = 0;

            for (const a of reportFiltered) {
                const v = a[key] as MentalFrequencyApi | null | undefined;
                if (!v) continue;
                if (!(v in FREQUENCY_SCORES)) continue;
                counts[v] += 1;
                answered += 1;
                sumScore += FREQUENCY_SCORES[v];
            }

            const avgItem = answered > 0 ? sumScore / answered : 0;

            // most common frequency
            const freqOrder: MentalFrequencyApi[] = [
                "not_at_all",
                "several_days",
                "more_than_half",
                "nearly_every_day",
            ];
            let top: MentalFrequencyApi | null = null;
            let topCount = -1;
            for (const f of freqOrder) {
                if (counts[f] > topCount) {
                    top = f;
                    topCount = counts[f];
                }
            }

            return {
                key,
                question: MH_QUESTIONS[key],
                answered,
                avgItem,
                mostCommon: top,
                counts,
            };
        });

        // Order report rows by newest
        scoreRows.sort((a, b) => {
            const ta = a.assessment.created_at ? Date.parse(a.assessment.created_at) : 0;
            const tb = b.assessment.created_at ? Date.parse(b.assessment.created_at) : 0;
            return tb - ta;
        });

        return {
            total,
            uniqueStudents: uniqueStudents.size,
            consented,
            noConsent: total - consented,
            averageScore,
            answeredAvg,
            severityCounts,
            flagged,
            scoreRows,
            itemStats,
        };
    }, [reportFiltered]);

    return (
        <DashboardLayout
            title="Intake"
            description="Review mental health needs assessment submissions (Steps 1–3) and generate score/statistics-based assessment reports."
        >
            <div className="flex w-full justify-center">
                <div className="w-full px-4 space-y-4">
                    {/* ✅ ACTION BUTTONS OUTSIDE THE ALERT CARD + FAR RIGHT */}
                    <div className="relative z-20 flex w-full items-center justify-end gap-2">
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

                        <Button size="sm" className="bg-amber-600 text-xs text-white hover:bg-amber-700" asChild>
                            <Link to="/dashboard/counselor/appointments">Open Appointments</Link>
                        </Button>
                    </div>

                    {/* Info Alert (no buttons inside) */}
                    <Alert className="border-amber-100 bg-amber-50/70">
                        <AlertTitle className="text-sm font-semibold text-amber-900">
                            Guidance &amp; Counseling – Intake (Assessments)
                        </AlertTitle>
                        <AlertDescription className="text-xs text-amber-900/80">
                            Counseling requests are now handled as{" "}
                            <span className="font-medium">appointments</span>. Go to{" "}
                            <Link
                                to="/dashboard/counselor/appointments"
                                className="font-semibold underline"
                            >
                                Appointments
                            </Link>{" "}
                            to schedule or reschedule.
                        </AlertDescription>
                    </Alert>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <ClipboardListIcon className="h-4 w-4 text-amber-600" />
                                Intake assessments (Steps 1–3)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                View individual submissions and generate{" "}
                                <span className="font-medium">assessment reports</span> using PHQ-9 style scores.
                                Scores are for triage only and{" "}
                                <span className="font-medium">are not diagnostic labels</span>.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            {assessmentsError && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Unable to load assessment submissions</AlertTitle>
                                    <AlertDescription className="text-xs text-red-800/90">
                                        {assessmentsError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {isLoadingAssessments && !assessments.length ? (
                                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading assessment submissions…
                                </div>
                            ) : null}

                            <Tabs defaultValue="submissions" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="submissions" className="text-xs">
                                        Submissions
                                    </TabsTrigger>
                                    <TabsTrigger value="report" className="text-xs">
                                        <span className="inline-flex items-center gap-1.5">
                                            <BarChart3 className="h-3.5 w-3.5" />
                                            Assessment Report
                                        </span>
                                    </TabsTrigger>
                                </TabsList>

                                {/* ---------------- SUBMISSIONS ---------------- */}
                                <TabsContent value="submissions" className="space-y-3">
                                    {!isLoadingAssessments &&
                                        assessments.length === 0 &&
                                        !assessmentsError && (
                                            <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                                No assessment submissions have been recorded yet.
                                                <br />
                                                Once students submit the intake assessment, they will appear here.
                                            </div>
                                        )}

                                    {!isLoadingAssessments && assessments.length > 0 && (
                                        <div className="rounded-md border bg-background">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-xs">Student</TableHead>
                                                        <TableHead className="text-xs">Submitted</TableHead>
                                                        <TableHead className="text-xs">Consent</TableHead>
                                                        <TableHead className="text-xs">Score</TableHead>
                                                        <TableHead className="text-xs">Severity</TableHead>
                                                        <TableHead className="text-right text-xs">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {assessments.map((assessment) => {
                                                        const studentName = getStudentDisplayName(assessment);
                                                        const created = formatDateTime(assessment.created_at);

                                                        const { score, answered } = calculatePhqScore(assessment);
                                                        const severity = phqSeverityLabel(score);

                                                        const hasConsent = assessment.consent === true;

                                                        return (
                                                            <TableRow key={assessment.id}>
                                                                <TableCell className="py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <UserCircle2 className="h-4 w-4 text-amber-700" />
                                                                        <div className="space-y-0.5">
                                                                            <p className="text-xs font-semibold text-foreground">
                                                                                {studentName}
                                                                            </p>
                                                                            <p className="text-[0.7rem] text-muted-foreground">
                                                                                Age:{" "}
                                                                                {typeof assessment.age === "number"
                                                                                    ? assessment.age
                                                                                    : "—"}{" "}
                                                                                • Gender: {formatGender(assessment.gender ?? undefined)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {created}
                                                                </TableCell>

                                                                <TableCell>
                                                                    {hasConsent ? (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="border-emerald-200 bg-emerald-50 text-[0.7rem] text-emerald-800"
                                                                        >
                                                                            Consented
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="border-red-200 bg-red-50 text-[0.7rem] text-red-700"
                                                                        >
                                                                            No consent
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>

                                                                <TableCell className="text-xs">
                                                                    <span className="font-semibold">{score}</span>{" "}
                                                                    <span className="text-[0.7rem] text-muted-foreground">
                                                                        /27 • {answered}/9
                                                                    </span>
                                                                </TableCell>

                                                                <TableCell>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-[0.7rem] ${severityBadgeClass(
                                                                            severity,
                                                                        )}`}
                                                                    >
                                                                        {severity}
                                                                    </Badge>
                                                                </TableCell>

                                                                <TableCell className="text-right">
                                                                    <div className="flex flex-wrap justify-end gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 text-[0.7rem]"
                                                                            onClick={() => openAssessmentDialog(assessment)}
                                                                        >
                                                                            View
                                                                        </Button>

                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 border-red-200 bg-white text-[0.7rem] text-red-700 hover:bg-red-50"
                                                                            onClick={() => askDelete(assessment)}
                                                                            disabled={isDeleting}
                                                                        >
                                                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                                            Delete
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* ---------------- REPORT ---------------- */}
                                <TabsContent value="report" className="space-y-4">
                                    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
                                        <div className="space-y-1">
                                            <p className="text-[0.7rem] font-medium text-muted-foreground">
                                                Search student
                                            </p>
                                            <Input
                                                value={reportSearch}
                                                onChange={(e) => setReportSearch(e.target.value)}
                                                placeholder="Name, user ID, student ID…"
                                                className="h-9 text-xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[0.7rem] font-medium text-muted-foreground">
                                                Date range
                                            </p>
                                            <Select
                                                value={reportRange}
                                                onValueChange={(v) => setReportRange(v as ReportRangePreset)}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Select range" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All time</SelectItem>
                                                    <SelectItem value="7d">Last 7 days</SelectItem>
                                                    <SelectItem value="30d">Last 30 days</SelectItem>
                                                    <SelectItem value="90d">Last 90 days</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-[0.7rem] font-medium text-muted-foreground">
                                                Consent filter
                                            </p>
                                            <Select
                                                value={reportConsent}
                                                onValueChange={(v) => setReportConsent(v as ReportConsentFilter)}
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Select consent" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All submissions</SelectItem>
                                                    <SelectItem value="consented">Consented only</SelectItem>
                                                    <SelectItem value="no_consent">No consent only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold text-foreground">
                                                Report summary
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {rangeLabel(reportRange)} • {reportConsent === "all"
                                                    ? "All consent states"
                                                    : reportConsent === "consented"
                                                        ? "Consented only"
                                                        : "No consent only"}{" "}
                                                • {reportStats.total} submission(s)
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() =>
                                                downloadAssessmentReportPdf(reportFiltered, {
                                                    preset: reportRange,
                                                    consent: reportConsent,
                                                    search: reportSearch,
                                                })
                                            }
                                            disabled={reportStats.total === 0}
                                            className="w-full text-xs sm:w-auto"
                                        >
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Report PDF
                                        </Button>
                                    </div>

                                    {reportStats.total === 0 ? (
                                        <div className="rounded-md border border-dashed bg-background px-4 py-6 text-center text-xs text-muted-foreground">
                                            No submissions match the selected filters.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <Card>
                                                    <CardHeader className="space-y-1 pb-2">
                                                        <CardTitle className="text-xs text-muted-foreground">
                                                            Submissions
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-2xl font-semibold">{reportStats.total}</p>
                                                        <p className="text-[0.7rem] text-muted-foreground">
                                                            Filtered rows
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardHeader className="space-y-1 pb-2">
                                                        <CardTitle className="text-xs text-muted-foreground">
                                                            Unique students
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-2xl font-semibold">{reportStats.uniqueStudents}</p>
                                                        <p className="text-[0.7rem] text-muted-foreground">
                                                            Based on user_id
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardHeader className="space-y-1 pb-2">
                                                        <CardTitle className="text-xs text-muted-foreground">
                                                            Average score
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-2xl font-semibold">
                                                            {reportStats.averageScore.toFixed(1)}
                                                        </p>
                                                        <p className="text-[0.7rem] text-muted-foreground">
                                                            / 27 (triage only)
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardHeader className="space-y-1 pb-2">
                                                        <CardTitle className="text-xs text-muted-foreground">
                                                            Answer completeness
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-2xl font-semibold">
                                                            {reportStats.answeredAvg.toFixed(1)}
                                                        </p>
                                                        <p className="text-[0.7rem] text-muted-foreground">
                                                            Avg answered / 9 items
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <div className="grid gap-3 lg:grid-cols-2">
                                                <Card className="border-amber-100/80 bg-white/80">
                                                    <CardHeader className="space-y-1">
                                                        <CardTitle className="text-sm">
                                                            Severity distribution
                                                        </CardTitle>
                                                        <CardDescription className="text-xs">
                                                            Based on PHQ-9 style bands (triage only).
                                                        </CardDescription>
                                                    </CardHeader>

                                                    <CardContent className="space-y-3">
                                                        {SEVERITY_BANDS.map((sev) => {
                                                            const count = reportStats.severityCounts[sev] ?? 0;
                                                            const pct = reportStats.total
                                                                ? Math.round((count / reportStats.total) * 100)
                                                                : 0;

                                                            return (
                                                                <div key={sev} className="space-y-1">
                                                                    <div className="flex items-center justify-between text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge
                                                                                variant="outline"
                                                                                className={`text-[0.7rem] ${severityBadgeClass(
                                                                                    sev,
                                                                                )}`}
                                                                            >
                                                                                {sev}
                                                                            </Badge>
                                                                            <span className="text-muted-foreground">
                                                                                {count} student(s)
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-muted-foreground">{pct}%</span>
                                                                    </div>

                                                                    <Progress value={pct} className="h-2" />
                                                                </div>
                                                            );
                                                        })}

                                                        <div className="pt-2 text-[0.7rem] text-muted-foreground">
                                                            Consented:{" "}
                                                            <span className="font-medium text-foreground">
                                                                {reportStats.consented}
                                                            </span>{" "}
                                                            • No consent:{" "}
                                                            <span className="font-medium text-foreground">
                                                                {reportStats.noConsent}
                                                            </span>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card className="border-amber-100/80 bg-white/80">
                                                    <CardHeader className="space-y-1">
                                                        <CardTitle className="flex items-center gap-2 text-sm">
                                                            <ShieldAlert className="h-4 w-4 text-amber-700" />
                                                            High-attention flags
                                                        </CardTitle>
                                                        <CardDescription className="text-xs">
                                                            Flags are based on the self-harm item being “More than half” or “Nearly every day”.
                                                            Follow your office protocol immediately.
                                                        </CardDescription>
                                                    </CardHeader>

                                                    <CardContent className="space-y-3">
                                                        {reportStats.flagged.length === 0 ? (
                                                            <div className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                                                                No flagged submissions in the selected range.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="border-red-200 bg-red-50 text-red-700"
                                                                    >
                                                                        {reportStats.flagged.length} flagged
                                                                    </Badge>
                                                                    <span className="text-[0.7rem] text-muted-foreground">
                                                                        Showing newest first
                                                                    </span>
                                                                </div>

                                                                <div className="rounded-md border bg-background">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead className="text-xs">Student</TableHead>
                                                                                <TableHead className="text-xs">Submitted</TableHead>
                                                                                <TableHead className="text-xs text-right">Action</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>

                                                                        <TableBody>
                                                                            {reportStats.flagged.slice(0, 6).map((row) => {
                                                                                const a = row.assessment;
                                                                                return (
                                                                                    <TableRow key={a.id}>
                                                                                        <TableCell className="py-3">
                                                                                            <div className="space-y-0.5">
                                                                                                <p className="text-xs font-semibold">
                                                                                                    {getStudentDisplayName(a)}
                                                                                                </p>
                                                                                                <p className="text-[0.7rem] text-muted-foreground">
                                                                                                    Self-harm:{" "}
                                                                                                    <span className="font-medium text-foreground">
                                                                                                        {prettyFrequency(
                                                                                                            a.mh_self_harm as MentalFrequencyApi | null | undefined,
                                                                                                        )}
                                                                                                    </span>
                                                                                                </p>
                                                                                            </div>
                                                                                        </TableCell>
                                                                                        <TableCell className="text-xs text-muted-foreground">
                                                                                            {formatDateTime(a.created_at)}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right">
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                className="h-8 text-[0.7rem]"
                                                                                                onClick={() => openAssessmentDialog(a)}
                                                                                            >
                                                                                                View details
                                                                                            </Button>
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                );
                                                                            })}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>

                                                                {reportStats.flagged.length > 6 && (
                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                        +{reportStats.flagged.length - 6} more flagged submission(s) not shown.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <Card className="border-amber-100/80 bg-white/80">
                                                <CardHeader className="space-y-1">
                                                    <CardTitle className="text-sm">
                                                        Item-level statistics
                                                    </CardTitle>
                                                    <CardDescription className="text-xs">
                                                        Average per item is scored 0–3 (Not at all → Nearly every day).
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="rounded-md border bg-background">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="text-xs">Question</TableHead>
                                                                    <TableHead className="text-xs">Answered</TableHead>
                                                                    <TableHead className="text-xs">Average</TableHead>
                                                                    <TableHead className="text-xs">Most common</TableHead>
                                                                </TableRow>
                                                            </TableHeader>

                                                            <TableBody>
                                                                {reportStats.itemStats.map((row) => {
                                                                    const mostCommonLabel = row.mostCommon
                                                                        ? MENTAL_FREQUENCY_LABELS[row.mostCommon]
                                                                        : "—";
                                                                    return (
                                                                        <TableRow key={String(row.key)}>
                                                                            <TableCell className="py-3">
                                                                                <div className="space-y-0.5">
                                                                                    <p className="text-xs font-medium text-foreground">
                                                                                        {row.question}
                                                                                    </p>
                                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                                        {String(row.key)}
                                                                                    </p>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-xs">
                                                                                {row.answered} / {reportStats.total}
                                                                            </TableCell>
                                                                            <TableCell className="text-xs font-semibold">
                                                                                {row.avgItem.toFixed(2)}
                                                                            </TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground">
                                                                                {mostCommonLabel}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>

                                                    <div className="mt-3 rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-[0.7rem] text-amber-900/90">
                                                        <span className="font-semibold">Reminder:</span> These statistics are for
                                                        counselor triage/reporting only and do not represent a clinical diagnosis.
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-amber-100/80 bg-white/80">
                                                <CardHeader className="space-y-1">
                                                    <CardTitle className="text-sm">Filtered submission list</CardTitle>
                                                    <CardDescription className="text-xs">
                                                        This table matches your filters and is useful for quick review and verification.
                                                    </CardDescription>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="rounded-md border bg-background">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="text-xs">Student</TableHead>
                                                                    <TableHead className="text-xs">Submitted</TableHead>
                                                                    <TableHead className="text-xs">Score</TableHead>
                                                                    <TableHead className="text-xs">Severity</TableHead>
                                                                    <TableHead className="text-xs">Consent</TableHead>
                                                                    <TableHead className="text-right text-xs">Action</TableHead>
                                                                </TableRow>
                                                            </TableHeader>

                                                            <TableBody>
                                                                {reportStats.scoreRows.slice(0, 12).map((row) => {
                                                                    const a = row.assessment;
                                                                    return (
                                                                        <TableRow key={a.id}>
                                                                            <TableCell className="py-3">
                                                                                <div className="space-y-0.5">
                                                                                    <p className="text-xs font-semibold">
                                                                                        {getStudentDisplayName(a)}
                                                                                    </p>
                                                                                    <p className="text-[0.7rem] text-muted-foreground">
                                                                                        User ID: {String(a.user_id ?? "—")}
                                                                                    </p>
                                                                                </div>
                                                                            </TableCell>

                                                                            <TableCell className="text-xs text-muted-foreground">
                                                                                {formatDateTime(a.created_at)}
                                                                            </TableCell>

                                                                            <TableCell className="text-xs">
                                                                                <span className="font-semibold">{row.score}</span>{" "}
                                                                                <span className="text-[0.7rem] text-muted-foreground">
                                                                                    /27 • {row.answered}/9
                                                                                </span>
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className={`text-[0.7rem] ${severityBadgeClass(
                                                                                        row.severity,
                                                                                    )}`}
                                                                                >
                                                                                    {row.severity}
                                                                                </Badge>
                                                                            </TableCell>

                                                                            <TableCell>
                                                                                {a.consent === true ? (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="border-emerald-200 bg-emerald-50 text-[0.7rem] text-emerald-800"
                                                                                    >
                                                                                        Yes
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="border-red-200 bg-red-50 text-[0.7rem] text-red-700"
                                                                                    >
                                                                                        No
                                                                                    </Badge>
                                                                                )}
                                                                            </TableCell>

                                                                            <TableCell className="text-right">
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-[0.7rem]"
                                                                                    onClick={() => openAssessmentDialog(a)}
                                                                                >
                                                                                    View
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>

                                                    {reportStats.scoreRows.length > 12 && (
                                                        <p className="mt-2 text-[0.7rem] text-muted-foreground">
                                                            Showing 12 of {reportStats.scoreRows.length} matched submission(s).
                                                        </p>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>
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
                                            {typeof selectedAssessment.age === "number"
                                                ? selectedAssessment.age
                                                : "—"}
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
                                            <Badge
                                                variant="outline"
                                                className={`text-[0.7rem] ${severityBadgeClass(dialogSeverity)}`}
                                            >
                                                {dialogSeverity}
                                            </Badge>
                                        </p>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            Based on PHQ-9 style scoring for triage only; not a diagnosis or clinical label.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-amber-900">Item-by-item responses</p>

                                    <div className="rounded-md border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs">Question</TableHead>
                                                    <TableHead className="text-right text-xs">Answer</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {MH_KEYS.map((key) => (
                                                    <TableRow key={String(key)}>
                                                        <TableCell className="py-3 text-xs text-muted-foreground">
                                                            {MH_QUESTIONS[key]}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right text-xs font-medium text-amber-900">
                                                            {prettyFrequency(
                                                                selectedAssessment[key] as MentalFrequencyApi | null | undefined,
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
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

            {/* Delete confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base">Delete assessment?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            You are about to delete the assessment submitted by{" "}
                            <span className="font-medium text-foreground">
                                {deleteTarget ? getStudentDisplayName(deleteTarget) : "this student"}
                            </span>
                            . This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void confirmDelete();
                            }}
                            disabled={isDeleting}
                            className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default CounselorIntake;
