/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, RefreshCcw, Users } from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/DashboardLayout"
import { fetchStudentsForManualScores, type CaseLoadStudent } from "@/lib/manual-scores"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"

function initials(name?: string | null) {
    const n = (name ?? "").trim()
    if (!n) return "ST"
    const parts = n.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? "S"
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase()
}

function getStudentDisplayName(s: CaseLoadStudent): string {
    const anyS = s as any
    const name =
        s?.name ??
        anyS?.full_name ??
        anyS?.fullName ??
        anyS?.student_name ??
        anyS?.studentName ??
        anyS?.user?.name ??
        anyS?.student?.name ??
        null
    return typeof name === "string" && name.trim() ? name.trim() : "Unknown Student"
}

export default function CounselorCaseLoadPage() {
    const navigate = useNavigate()

    const [students, setStudents] = React.useState<CaseLoadStudent[]>([])
    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        setError(null)
        try {
            const res = await fetchStudentsForManualScores()
            setStudents(res ?? [])
        } catch (e: any) {
            setError(e?.message ?? "Failed to load student users.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true)
        try {
            await load()
            toast.success("Students refreshed.")
        } finally {
            setRefreshing(false)
        }
    }, [load])

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return students
        return students.filter((s) => {
            const anyS = s as any
            const hay = [
                getStudentDisplayName(s),
                anyS?.email,
                anyS?.student_id,
                anyS?.program,
                anyS?.year_level,
                String(anyS?.id ?? ""),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return hay.includes(q)
        })
    }, [students, query])

    return (
        <DashboardLayout title="Case Load" description="Student users available for manual assessment score encoding.">
            <Card>
                <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Case Load
                            </CardTitle>
                            <CardDescription>Select a student to encode hardcopy assessment scores.</CardDescription>
                        </div>

                        <Button
                            variant="outline"
                            onClick={onRefresh}
                            disabled={refreshing || loading}
                            className="gap-2"
                        >
                            {refreshing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCcw className="h-4 w-4" />
                            )}
                            Refresh
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, email, student ID, program…"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="w-fit">
                                {filtered.length} student{filtered.length === 1 ? "" : "s"}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {error ? (
                        <Alert variant="destructive">
                            <AlertTitle>Unable to load students</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}

                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
                            No students found.
                        </div>
                    ) : (
                        <ScrollArea className="w-full">
                            <div className="min-w-[760px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Student ID</TableHead>
                                            <TableHead>Program</TableHead>
                                            <TableHead>Year Level</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((s) => {
                                            const anyS = s as any
                                            const displayName = getStudentDisplayName(s)
                                            const sid = anyS?.student_id ?? "—"
                                            const program = anyS?.program ?? "—"
                                            const year = anyS?.year_level ?? "—"
                                            const avatar = anyS?.avatar_url ?? null

                                            return (
                                                <TableRow key={String(anyS?.id ?? s.id)}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9">
                                                                <AvatarImage src={avatar ?? undefined} alt={displayName} />
                                                                <AvatarFallback>{initials(displayName)}</AvatarFallback>
                                                            </Avatar>

                                                            <div className="min-w-0">
                                                                <div className="truncate font-medium text-foreground">
                                                                    {displayName}
                                                                </div>
                                                                <div className="truncate text-xs text-muted-foreground">
                                                                    {anyS?.email ?? "—"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="font-mono text-xs">{sid}</TableCell>
                                                    <TableCell>{program}</TableCell>
                                                    <TableCell>{year}</TableCell>

                                                    <TableCell className="text-right">
                                                        <Button
                                                            onClick={() => {
                                                                const id = String(anyS?.id ?? s.id)
                                                                const name = encodeURIComponent(displayName)
                                                                navigate(
                                                                    `/dashboard/counselor/assessment-score-input?studentId=${encodeURIComponent(
                                                                        id,
                                                                    )}&studentName=${name}`,
                                                                )
                                                            }}
                                                        >
                                                            Encode Score
                                                        </Button>
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
        </DashboardLayout>
    )
}
