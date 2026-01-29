/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";

import { getAdminAnalyticsApi } from "@/api/admin-analytics/route";
import type { MonthlyCountRow } from "@/api/analytics/route";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

function safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function monthLabel(year: number, month: number) {
    const d = new Date(year, Math.max(0, month - 1), 1);
    return format(d, "MMM yyyy");
}

/**
 * ✅ Make Recharts follow src/index.css tokens (OKLCH variables)
 * We READ the CSS variables and pass actual color strings to Recharts,
 * instead of using `hsl(var(--...))` which breaks when vars are OKLCH.
 */
type ChartTheme = {
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    border: string;
    mutedForeground: string;
    foreground: string;
    card: string;
    cardForeground: string;
};

function getCssVar(name: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function readChartTheme(): ChartTheme {
    // Fallbacks match your src/index.css values (so it still looks right if styles load late)
    return {
        chart1: getCssVar("--chart-1", "oklch(0.646 0.222 41.116)"),
        chart2: getCssVar("--chart-2", "oklch(0.6 0.118 184.704)"),
        chart3: getCssVar("--chart-3", "oklch(0.398 0.07 227.392)"),
        chart4: getCssVar("--chart-4", "oklch(0.828 0.189 84.429)"),
        chart5: getCssVar("--chart-5", "oklch(0.769 0.188 70.08)"),
        border: getCssVar("--border", "oklch(0.922 0 0)"),
        mutedForeground: getCssVar("--muted-foreground", "oklch(0.556 0 0)"),
        foreground: getCssVar("--foreground", "oklch(0.145 0 0)"),
        card: getCssVar("--card", "oklch(1 0 0)"),
        cardForeground: getCssVar("--card-foreground", "oklch(0.145 0 0)"),
    };
}

function ChartTooltipContent({
    active,
    payload,
    label,
    theme,
}: {
    active?: boolean;
    payload?: any[];
    label?: string;
    theme: ChartTheme;
}) {
    if (!active || !payload || payload.length === 0) return null;

    const value = safeNumber(payload?.[0]?.value);
    const dotStyle: React.CSSProperties = {
        backgroundColor: theme.chart1,
    };

    return (
        <div className="rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 flex items-center gap-3">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={dotStyle} />
                <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-sm font-medium">Count</span>
                    <span className="font-semibold tabular-nums">{value}</span>
                </div>
            </div>
        </div>
    );
}

export default function AdminAnalytics() {
    const today = new Date();

    const defaultEnd = format(today, "yyyy-MM-dd");
    const defaultStart = format(new Date(today.getFullYear(), today.getMonth() - 5, 1), "yyyy-MM-dd");

    const [startDate, setStartDate] = React.useState<string>(defaultStart);
    const [endDate, setEndDate] = React.useState<string>(defaultEnd);

    const [loading, setLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    const [thisMonth, setThisMonth] = React.useState<number>(0);
    const [thisSemester, setThisSemester] = React.useState<number>(0);
    const [rangeText, setRangeText] = React.useState<string>("");

    const [monthly, setMonthly] = React.useState<MonthlyCountRow[]>([]);

    // ✅ Read CSS tokens for chart styling
    const [theme, setTheme] = React.useState<ChartTheme>(() => readChartTheme());

    React.useEffect(() => {
        // initial
        setTheme(readChartTheme());

        // watch for theme/class changes (e.g., toggling .dark)
        const obs = new MutationObserver(() => {
            setTheme(readChartTheme());
        });

        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"],
        });

        return () => obs.disconnect();
    }, []);

    const totalInRange = React.useMemo(() => {
        return (monthly ?? []).reduce((acc, r) => acc + safeNumber(r?.count), 0);
    }, [monthly]);

    const chartData = React.useMemo(() => {
        const sorted = [...(monthly ?? [])].sort((a, b) => {
            const da = a.year * 100 + a.month;
            const db = b.year * 100 + b.month;
            return da - db;
        });

        return sorted.map((r) => ({
            name: monthLabel(r.year, r.month),
            count: safeNumber(r.count),
            year: r.year,
            month: r.month,
        }));
    }, [monthly]);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // ✅ Admin analytics endpoint
            const res = await getAdminAnalyticsApi({
                start_date: startDate,
                end_date: endDate,
            });

            setThisMonth(safeNumber(res?.this_month_count));
            setThisSemester(safeNumber(res?.this_semester_count));
            setMonthly(Array.isArray(res?.monthly_counts) ? res.monthly_counts : []);

            const rs = res?.range?.start_date ?? startDate;
            const re = res?.range?.end_date ?? endDate;
            setRangeText(rs && re ? `${rs} to ${re}` : "");

            if (import.meta.env.DEV) {
                console.debug("[admin analytics] payload:", res);
            }
        } catch (e: any) {
            const message = e?.message || "Failed to load analytics.";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    React.useEffect(() => {
        load();
    }, [load]);

    return (
        <DashboardLayout
            title="Analytics"
            description="Overview of activity and monthly trends"
        >
            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filters</CardTitle>
                    <CardDescription>Adjust the date range and refresh the report.</CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Start date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">End date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-end gap-2">
                            <Button
                                type="button"
                                onClick={load}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Refresh
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {rangeText ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                            Range: <span className="font-medium text-foreground">{rangeText}</span>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="mt-3 text-sm text-destructive">
                            {error}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">This month</CardTitle>
                        <CardDescription className="text-xs">Total activity count</CardDescription>
                    </CardHeader>
                    <CardContent className="text-3xl font-bold">
                        {loading ? "—" : thisMonth}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">This semester</CardTitle>
                        <CardDescription className="text-xs">Total activity count</CardDescription>
                    </CardHeader>
                    <CardContent className="text-3xl font-bold">
                        {loading ? "—" : thisSemester}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total in range</CardTitle>
                        <CardDescription className="text-xs">Sum of monthly counts</CardDescription>
                    </CardHeader>
                    <CardContent className="text-3xl font-bold">
                        {loading ? "—" : totalInRange}
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Monthly trend</CardTitle>
                    <CardDescription>Counts per month (based on the selected range).</CardDescription>
                </CardHeader>

                <CardContent>
                    <div className={cn("h-80 w-full", loading ? "opacity-70" : "")}>
                        {chartData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No data for the selected range.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 10, left: 0 }}>
                                    {/* ✅ Use theme tokens from src/index.css */}
                                    <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        tickMargin={10}
                                        tick={{ fill: theme.mutedForeground, fontSize: 12 }}
                                        axisLine={{ stroke: theme.border }}
                                        tickLine={{ stroke: theme.border }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        width={40}
                                        tick={{ fill: theme.mutedForeground, fontSize: 12 }}
                                        axisLine={{ stroke: theme.border }}
                                        tickLine={{ stroke: theme.border }}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: theme.border }}
                                        content={(p: any) => <ChartTooltipContent {...p} theme={theme} />}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke={theme.chart1}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, fill: theme.chart1, stroke: theme.card, strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <Separator className="my-6" />

                    <div className="text-sm font-medium">Monthly breakdown</div>
                    <div className="mt-3 overflow-hidden rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40">Month</TableHead>
                                    <TableHead className="w-24 text-right">Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chartData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                                            No rows to display.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    chartData
                                        .slice()
                                        .reverse()
                                        .map((r) => (
                                            <TableRow key={`${r.year}-${r.month}`}>
                                                <TableCell className="font-medium">{r.name}</TableCell>
                                                <TableCell className="text-right">{r.count}</TableCell>
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
