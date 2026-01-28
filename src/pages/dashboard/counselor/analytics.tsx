/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

import { AUTH_API_BASE_URL } from "@/api/auth/route";
import { getCurrentSession } from "@/lib/authentication";

import { cn } from "@/lib/utils";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    RefreshCcw,
    BarChart3,
    CalendarRange,
    TrendingUp,
    AlertCircle,
} from "lucide-react";

type MonthlyCountRow = {
    year: number;
    month: number; // 1-12
    count: number;
};

type CounselorAnalyticsApiResponse = {
    message?: string;
    this_month_count: number;
    this_semester_count: number;
    range?: {
        start_date?: string;
        end_date?: string;
    };
    monthly_counts?: MonthlyCountRow[];
};

function trimSlash(s: string) {
    return s.replace(/\/+$/, "");
}

function monthLabel(year: number, month: number) {
    const m = Math.min(12, Math.max(1, Number(month)));
    const date = new Date(year, m - 1, 1);
    return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function sumCounts(rows: MonthlyCountRow[]) {
    return rows.reduce((acc, r) => acc + safeNumber(r.count), 0);
}

async function fetchCounselorAnalyticsRaw(params?: { start_date?: string; end_date?: string }) {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.");
    }

    const base = trimSlash(AUTH_API_BASE_URL);
    const sp = new URLSearchParams();

    if (params?.start_date) sp.set("start_date", params.start_date);
    if (params?.end_date) sp.set("end_date", params.end_date);

    const qs = sp.toString() ? `?${sp.toString()}` : "";
    const url = `${base}/counselor/analytics${qs}`;

    const session = getCurrentSession();
    const token =
        (session as any)?.token ??
        (session as any)?.access_token ??
        (session as any)?.accessToken ??
        null;

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
    });

    const text = await res.text();
    let json: any = null;

    if (text) {
        try {
            json = JSON.parse(text);
        } catch {
            json = null;
        }
    }

    if (!res.ok) {
        const msg =
            json?.message ||
            json?.error ||
            res.statusText ||
            "Failed to fetch counselor analytics.";
        throw new Error(msg);
    }

    const monthly_counts: MonthlyCountRow[] = Array.isArray(json?.monthly_counts)
        ? json.monthly_counts.map((r: any) => ({
            year: safeNumber(r?.year),
            month: safeNumber(r?.month),
            count: safeNumber(r?.count),
        }))
        : [];

    const payload: CounselorAnalyticsApiResponse = {
        message: json?.message,
        this_month_count: safeNumber(json?.this_month_count),
        this_semester_count: safeNumber(json?.this_semester_count),
        range: {
            start_date: json?.range?.start_date,
            end_date: json?.range?.end_date,
        },
        monthly_counts,
    };

    return payload;
}

export default function CounselorAnalytics() {
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string>("");

    const [startDate, setStartDate] = React.useState<string>("");
    const [endDate, setEndDate] = React.useState<string>("");

    const [thisMonth, setThisMonth] = React.useState<number>(0);
    const [thisSemester, setThisSemester] = React.useState<number>(0);
    const [rangeTotal, setRangeTotal] = React.useState<number>(0);

    const [rangeLabel, setRangeLabel] = React.useState<{ start?: string; end?: string }>({});
    const [monthly, setMonthly] = React.useState<Array<{ label: string; count: number }>>([]);

    const load = React.useCallback(
        async (opts?: { start_date?: string; end_date?: string; silent?: boolean }) => {
            const silent = !!opts?.silent;

            if (!silent) {
                setLoading(true);
                setError("");
            }

            try {
                const res = await fetchCounselorAnalyticsRaw({
                    start_date: opts?.start_date,
                    end_date: opts?.end_date,
                });

                setThisMonth(safeNumber(res.this_month_count));
                setThisSemester(safeNumber(res.this_semester_count));

                const rows = Array.isArray(res.monthly_counts) ? res.monthly_counts : [];
                const mapped = rows.map((r) => ({
                    label: monthLabel(r.year, r.month),
                    count: safeNumber(r.count),
                }));

                setMonthly(mapped);
                setRangeTotal(sumCounts(rows));
                setRangeLabel({
                    start: res?.range?.start_date,
                    end: res?.range?.end_date,
                });
            } catch (e: any) {
                const msg = e?.message || "Unable to load analytics.";
                setError(msg);

                if (!silent) {
                    toast.error(msg);
                }
            } finally {
                if (!silent) setLoading(false);
            }
        },
        []
    );

    React.useEffect(() => {
        load();
    }, [load]);

    const maxCount = React.useMemo(() => {
        if (!monthly.length) return 0;
        return Math.max(...monthly.map((x) => x.count));
    }, [monthly]);

    const handleApply = async () => {
        if (!startDate || !endDate) {
            toast.error("Please select both Start Date and End Date.");
            return;
        }

        if (startDate > endDate) {
            toast.error("Start Date must be earlier than (or equal to) End Date.");
            return;
        }

        await load({ start_date: startDate, end_date: endDate });
    };

    const handleReset = async () => {
        setStartDate("");
        setEndDate("");
        await load();
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Analytics
                            </CardTitle>
                            <CardDescription>
                                Track counseling request activity by month, semester, and custom date range.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => load({ start_date: startDate || undefined, end_date: endDate || undefined, silent: false })}
                                className="gap-2"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                </Card>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarRange className="h-5 w-5" />
                            Date Range Filter
                        </CardTitle>
                        <CardDescription>
                            Select a date range to view monthly totals within that window.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <div className="text-sm font-medium">Start Date</div>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">End Date</div>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button type="button" onClick={handleApply} className="w-full">
                                    Apply
                                </Button>
                                <Button type="button" variant="outline" onClick={handleReset} className="w-full">
                                    Reset
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {rangeLabel?.start && rangeLabel?.end ? (
                                <>
                                    <Badge variant="secondary">
                                        Range: {rangeLabel.start} → {rangeLabel.end}
                                    </Badge>
                                    <Badge variant="outline">Range Total: {rangeTotal}</Badge>
                                </>
                            ) : (
                                <Badge variant="secondary">Range: last 12 months (default)</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Summary */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">This Month</CardTitle>
                            <CardDescription>Counseling requests created this month</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-10 w-28" />
                            ) : (
                                <div className="text-3xl font-semibold">{thisMonth}</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">This Semester</CardTitle>
                            <CardDescription>Counseling requests created this semester</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-10 w-28" />
                            ) : (
                                <div className="text-3xl font-semibold">{thisSemester}</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Range Total</CardTitle>
                            <CardDescription>Total requests inside selected range</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-10 w-28" />
                            ) : (
                                <div className="text-3xl font-semibold">{rangeTotal}</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Monthly Trend
                        </CardTitle>
                        <CardDescription>
                            Monthly request counts (bars are relative to the highest month in the current view).
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {error ? (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Analytics Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : monthly.length === 0 ? (
                            <Alert>
                                <AlertTitle>No data</AlertTitle>
                                <AlertDescription>
                                    No monthly records were returned for the selected range.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-3">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[180px]">Month</TableHead>
                                            <TableHead className="w-[120px]">Requests</TableHead>
                                            <TableHead>Trend</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthly.map((m) => {
                                            const pct =
                                                maxCount > 0 ? Math.round((m.count / maxCount) * 100) : 0;

                                            return (
                                                <TableRow key={m.label}>
                                                    <TableCell className="font-medium">{m.label}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{m.count}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Progress value={pct} className={cn("h-2 w-full")} />
                                                            <div className="w-12 text-right text-xs text-muted-foreground">
                                                                {pct}%
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
