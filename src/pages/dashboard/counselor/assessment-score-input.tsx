/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/DashboardLayout"
import {
    fetchCounselorCaseLoad,
    fetchStudentManualScores,
    saveManualAssessmentScore,
    type CaseLoadStudent,
    type ManualScoreRecord,
} from "@/lib/manual-scores"

import { cn } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"

function scoreToRating(score: number): string {
    if (!Number.isFinite(score)) return "—"
    if (score < 50) return "Poor"
    if (score < 70) return "Fair"
    if (score < 85) return "Good"
    return "Very Good"
}

function normalizeScoreDate(r: ManualScoreRecord): string | null {
    const anyR = r as any
    return (
        (typeof anyR?.assessed_date === "string" && anyR.assessed_date) ||
        (typeof anyR?.assessedDate === "string" && anyR.assessedDate) ||
        (typeof anyR?.date === "string" && anyR.date) ||
        null
    )
}

export default function CounselorAssessmentScoreInputPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const initialStudentId = searchParams.get("studentId")
    const initialStudentName = searchParams.get("studentName")

    const [caseLoad, setCaseLoad] = React.useState<CaseLoadStudent[]>([])
    const [caseLoadLoading, setCaseLoadLoading] = React.useState(true)
    const [caseLoadError, setCaseLoadError] = React.useState<string | null>(null)

    const [studentId, setStudentId] = React.useState<string>(initialStudentId ? String(initialStudentId) : "")
    const [studentName, setStudentName] = React.useState<string>(initialStudentName ? String(initialStudentName) : "")

    const selectedStudent = React.useMemo(() => {
        if (!studentId) return null
        const found = caseLoad.find((s) => String(s.id) === String(studentId))
        return found ?? null
    }, [caseLoad, studentId])

    const [studentPickerOpen, setStudentPickerOpen] = React.useState(false)

    const [scoreText, setScoreText] = React.useState("")
    const scoreNumber = React.useMemo(() => Number(scoreText), [scoreText])
    const rating = React.useMemo(() => scoreToRating(scoreNumber), [scoreNumber])

    const [assessedDate, setAssessedDate] = React.useState<Date | undefined>(new Date())
    const assessedDateValue = assessedDate ? format(assessedDate, "yyyy-MM-dd") : ""

    const [remarks, setRemarks] = React.useState("")

    const [history, setHistory] = React.useState<ManualScoreRecord[]>([])
    const [historyLoading, setHistoryLoading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)

    const loadCaseLoad = React.useCallback(async () => {
        setCaseLoadError(null)
        setCaseLoadLoading(true)
        try {
            const students = await fetchCounselorCaseLoad()
            setCaseLoad(students ?? [])
        } catch (e: any) {
            setCaseLoadError(e?.message ?? "Failed to load counselor case load.")
        } finally {
            setCaseLoadLoading(false)
        }
    }, [])

    const loadHistory = React.useCallback(async (sid: string) => {
        if (!sid) return
        setHistoryLoading(true)
        try {
            const rows = await fetchStudentManualScores(sid)
            setHistory(rows ?? [])
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load score history.")
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void loadCaseLoad()
    }, [loadCaseLoad])

    React.useEffect(() => {
        if (!studentId) return
        void loadHistory(studentId)
    }, [studentId, loadHistory])

    React.useEffect(() => {
        if (!selectedStudent) return
        setStudentName(selectedStudent?.name ?? "")
    }, [selectedStudent])

    const onPickStudent = React.useCallback(
        (s: CaseLoadStudent) => {
            const nextId = String(s.id)
            setStudentId(nextId)
            setStudentName(s?.name ?? "")
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.set("studentId", nextId)
                if (s?.name) next.set("studentName", s.name)
                return next
            })
            setStudentPickerOpen(false)
        },
        [setSearchParams],
    )

    const onSave = React.useCallback(async () => {
        if (!studentId) {
            toast.error("Please select a student.")
            return
        }

        const n = Number(scoreText)
        if (!Number.isFinite(n)) {
            toast.error("Please enter a valid numeric score.")
            return
        }
        if (n < 0 || n > 100) {
            toast.error("Score must be between 0 and 100.")
            return
        }
        if (!assessedDateValue) {
            toast.error("Please select an assessed date.")
            return
        }

        setSaving(true)
        try {
            // ✅ Send BOTH keys to be compatible with either backend validation:
            // - some versions expect `date`
            // - your controller snippet expects `assessed_date`
            await saveManualAssessmentScore({
                student_id: studentId,
                score: n,
                date: assessedDateValue,
                assessed_date: assessedDateValue,
                remarks: remarks?.trim() ? remarks.trim() : undefined,
            } as any)

            toast.success("Score saved.")
            setScoreText("")
            setRemarks("")
            await loadHistory(studentId)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to save score.")
        } finally {
            setSaving(false)
        }
    }, [studentId, scoreText, assessedDateValue, remarks, loadHistory])

    return (
        <DashboardLayout
            title="Hardcopy Assessment Score Input"
            description="Encode paper-based assessment scores and automatically map to rating."
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    <CardHeader className="space-y-1">
                        <CardTitle>Encode Score</CardTitle>
                        <CardDescription>Choose a student, input the hardcopy score, and save.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {caseLoadError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Case load unavailable</AlertTitle>
                                <AlertDescription>{caseLoadError}</AlertDescription>
                            </Alert>
                        ) : null}

                        <div className="space-y-2">
                            <Label>Student</Label>

                            {caseLoadLoading ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={studentPickerOpen}
                                            className="w-full justify-between"
                                        >
                                            <span className="truncate">
                                                {selectedStudent
                                                    ? `${selectedStudent?.name ?? "Student"} • ${selectedStudent?.student_id ?? "—"
                                                    }`
                                                    : studentName
                                                        ? studentName
                                                        : "Select student…"}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent
                                        className="p-0"
                                        align="start"
                                        style={{ width: "var(--radix-popover-trigger-width)" }}
                                    >
                                        <Command>
                                            <CommandInput placeholder="Search student…" />
                                            <CommandEmpty>No student found.</CommandEmpty>

                                            <CommandGroup>
                                                <ScrollArea className="h-64">
                                                    {caseLoad.map((s) => {
                                                        const id = String(s.id)
                                                        const label = `${s?.name ?? "Student"} • ${s?.student_id ?? "—"}`
                                                        const active = String(studentId) === id

                                                        return (
                                                            <CommandItem
                                                                key={id}
                                                                value={`${s?.name ?? ""} ${s?.student_id ?? ""} ${s?.email ?? ""
                                                                    } ${s?.program ?? ""}`}
                                                                onSelect={() => onPickStudent(s)}
                                                                className="flex items-center justify-between"
                                                            >
                                                                <span className="truncate">{label}</span>
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4",
                                                                        active ? "opacity-100" : "opacity-0",
                                                                    )}
                                                                />
                                                            </CommandItem>
                                                        )
                                                    })}
                                                </ScrollArea>
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}

                            {selectedStudent ? (
                                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                                    <div className="font-medium text-foreground">
                                        {selectedStudent?.name ?? "Student"}
                                    </div>
                                    <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                        <div>Student ID: {selectedStudent?.student_id ?? "—"}</div>
                                        <div>Year Level: {selectedStudent?.year_level ?? "—"}</div>
                                        <div>Program: {selectedStudent?.program ?? "—"}</div>
                                        <div>Email: {selectedStudent?.email ?? "—"}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">
                                    Tip: You can also open this page from{" "}
                                    <Button
                                        variant="link"
                                        className="h-auto p-0"
                                        onClick={() => navigate("/dashboard/counselor/case-load")}
                                    >
                                        Case Load
                                    </Button>
                                    .
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Score (0–100)</Label>
                                <Input
                                    value={scoreText}
                                    onChange={(e) => setScoreText(e.target.value)}
                                    placeholder="e.g., 78"
                                    inputMode="decimal"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Rating</Label>
                                <div className="flex h-10 items-center">
                                    <Badge variant="secondary" className="text-sm">
                                        {rating}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Assessed Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start gap-2",
                                            !assessedDate && "text-muted-foreground",
                                        )}
                                    >
                                        <CalendarIcon className="h-4 w-4" />
                                        {assessedDate ? format(assessedDate, "PPP") : "Pick a date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={assessedDate}
                                        onSelect={(d) => setAssessedDate(d ?? undefined)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="text-xs text-muted-foreground">Saved as: {assessedDateValue || "—"}</div>
                        </div>

                        <div className="space-y-2">
                            <Label>Remarks (optional)</Label>
                            <Textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add notes or interpretation..."
                                rows={4}
                            />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Button variant="outline" onClick={() => navigate("/dashboard/counselor/case-load")}>
                                Back to Case Load
                            </Button>

                            <Button onClick={onSave} disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Score
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader className="space-y-1">
                        <CardTitle>Score History</CardTitle>
                        <CardDescription>Previously encoded manual scores for the selected student.</CardDescription>
                    </CardHeader>

                    <CardContent>
                        {!studentId ? (
                            <Alert>
                                <AlertTitle>Select a student</AlertTitle>
                                <AlertDescription>Choose a student to view their manual score history.</AlertDescription>
                            </Alert>
                        ) : historyLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                                No manual scores found for this student yet.
                            </div>
                        ) : (
                            <ScrollArea className="w-full">
                                <div className="min-w-[760px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Score</TableHead>
                                                <TableHead>Rating</TableHead>
                                                <TableHead>Remarks</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {history.map((r) => {
                                                const dt = normalizeScoreDate(r)
                                                const scoreVal = (r as any)?.score
                                                const ratingVal =
                                                    (r as any)?.rating ?? scoreToRating(Number(scoreVal))
                                                const remarksVal = (r as any)?.remarks ?? "—"

                                                return (
                                                    <TableRow key={String((r as any)?.id ?? `${dt}-${scoreVal}`)}>
                                                        <TableCell className="font-mono text-xs">{dt ?? "—"}</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {Number.isFinite(Number(scoreVal))
                                                                ? Number(scoreVal).toFixed(2)
                                                                : "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">{String(ratingVal)}</Badge>
                                                        </TableCell>
                                                        <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                                                            {String(remarksVal)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
