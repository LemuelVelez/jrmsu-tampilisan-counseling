/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { fetchCounselorAssessments, type CounselorAssessmentRecord } from "@/lib/intake";
import { fetchCounselorManualScores, type ManualScoreRecord } from "@/lib/manual-scores";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Freq =
    | "not_at_all"
    | "several_days"
    | "more_than_half"
    | "nearly_every_day"
    | null
    | undefined
    | string;

function safeLower(s: unknown) {
    return String(s ?? "").toLowerCase();
}

function fmtDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
        return format(parseISO(iso), "PPP");
    } catch {
        return String(iso);
    }
}

function freqToPoints(v: Freq): number {
    const x = String(v ?? "");
    if (x === "not_at_all") return 0;
    if (x === "several_days") return 1;
    if (x === "more_than_half") return 2;
    if (x === "nearly_every_day") return 3;
    return 0;
}

function computePhq9(a: any): { score: number; severity: string } {
    const keys = [
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

    const score = keys.reduce((sum, k) => sum + freqToPoints(a?.[k]), 0);

    let severity = "Minimal";
    if (score >= 5 && score <= 9) severity = "Mild";
    else if (score >= 10 && score <= 14) severity = "Moderate";
    else if (score >= 15 && score <= 19) severity = "Moderately severe";
    else if (score >= 20) severity = "Severe";

    return { score, severity };
}

export default function CounselorAssessmentReportPage() {
    const navigate = useNavigate();

    const [loading, setLoading] = React.useState(true);

    const [assessments, setAssessments] = React.useState<CounselorAssessmentRecord[]>([]);
    const [manualScores, setManualScores] = React.useState<ManualScoreRecord[]>([]);

    const [error, setError] = React.useState<string | null>(null);

    const [searchAssessments, setSearchAssessments] = React.useState("");
    const [searchManual, setSearchManual] = React.useState("");

    const loadAll = React.useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const [a, m] = await Promise.all([fetchCounselorAssessments(), fetchCounselorManualScores()]);
            setAssessments(a ?? []);
            setManualScores(m ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load assessment reports.");
            setAssessments([]);
            setManualScores([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const filteredAssessments = React.useMemo(() => {
        const q = safeLower(searchAssessments).trim();
        if (!q) return assessments;

        return assessments.filter((r: any) => {
            const name = r?.user?.name ?? r?.student_name ?? "";
            const email = r?.user?.email ?? "";
            const uid = r?.user_id ?? "";
            return (
                safeLower(name).includes(q) ||
                safeLower(email).includes(q) ||
                safeLower(uid).includes(q)
            );
        });
    }, [assessments, searchAssessments]);

    const filteredManualScores = React.useMemo(() => {
        const q = safeLower(searchManual).trim();
        if (!q) return manualScores;

        return manualScores.filter((r: any) => {
            const studentName = r?.student?.name ?? r?.student_name ?? "";
            const studentId = r?.student?.student_id ?? r?.student_id ?? "";
            const email = r?.student?.email ?? "";
            const rating = r?.rating ?? "";
            return (
                safeLower(studentName).includes(q) ||
                safeLower(studentId).includes(q) ||
                safeLower(email).includes(q) ||
                safeLower(rating).includes(q)
            );
        });
    }, [manualScores, searchManual]);

    return (
        <DashboardLayout
            title="Assessment Reports"
            description="View intake assessments and hardcopy/manual scores for reporting and follow-up."
        >
            <div className="space-y-4">
                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Unable to load reports</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Intake assessments: <span className="font-medium text-foreground">{assessments.length}</span> •
                        Hardcopy scores: <span className="font-medium text-foreground">{manualScores.length}</span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/dashboard/counselor/assessment-score-input")}
                        >
                            Encode Hardcopy Scores
                        </Button>

                        <Button
                            onClick={() => {
                                toast.message("Refreshing reports…");
                                void loadAll();
                            }}
                            className="gap-2"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Intake Assessments */}
                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle>Intake Assessments</CardTitle>
                            <CardDescription>Latest intake assessment submissions (PHQ-9 computed in UI).</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <Input
                                value={searchAssessments}
                                onChange={(e) => setSearchAssessments(e.target.value)}
                                placeholder="Search name / email / user id…"
                            />

                            <Separator />

                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : filteredAssessments.length === 0 ? (
                                <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                                    No intake assessment records found.
                                </div>
                            ) : (
                                <ScrollArea className="w-full">
                                    <div className="w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead className="text-right">PHQ-9</TableHead>
                                                    <TableHead>Severity</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredAssessments.map((r: any) => {
                                                    const created = r?.created_at ?? r?.updated_at ?? null;
                                                    const studentName = r?.user?.name ?? r?.student_name ?? "—";
                                                    const phq = computePhq9(r);

                                                    return (
                                                        <TableRow key={String(r?.id ?? `${r?.user_id}-${created}`)}>
                                                            <TableCell className="font-mono text-xs">{fmtDate(created)}</TableCell>
                                                            <TableCell className="max-w-56 truncate">
                                                                <div className="font-medium text-foreground">{String(studentName)}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {String(r?.user?.email ?? "—")}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">{phq.score}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">{phq.severity}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>

                    {/* Manual / Hardcopy Scores */}
                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle>Hardcopy / Manual Scores</CardTitle>
                            <CardDescription>Scores encoded by counselors (paper-based assessments).</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <Input
                                value={searchManual}
                                onChange={(e) => setSearchManual(e.target.value)}
                                placeholder="Search student / id / email / rating…"
                            />

                            <Separator />

                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : filteredManualScores.length === 0 ? (
                                <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                                    No manual score records found.
                                </div>
                            ) : (
                                <ScrollArea className="w-full">
                                    <div className="w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead className="text-right">Score</TableHead>
                                                    <TableHead>Rating</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredManualScores.map((r: any) => {
                                                    const dt = r?.assessed_date ?? r?.date ?? null;
                                                    const studentName = r?.student?.name ?? r?.student_name ?? "—";
                                                    const studentId = r?.student?.student_id ?? r?.student_id ?? "—";
                                                    const scoreVal = r?.score;
                                                    const ratingVal = r?.rating ?? "—";

                                                    return (
                                                        <TableRow key={String(r?.id ?? `${studentId}-${dt}-${scoreVal}`)}>
                                                            <TableCell className="font-mono text-xs">{fmtDate(dt)}</TableCell>
                                                            <TableCell className="max-w-56 truncate">
                                                                <div className="font-medium text-foreground">{String(studentName)}</div>
                                                                <div className="text-xs text-muted-foreground">Student ID: {String(studentId)}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {Number.isFinite(Number(scoreVal)) ? Number(scoreVal).toFixed(2) : "—"}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">{String(ratingVal)}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
