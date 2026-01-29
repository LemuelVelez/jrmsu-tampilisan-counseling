/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";
import type { AnalyticsQuery, MonthlyCountRow } from "@/api/analytics/route";

export interface AdminAnalyticsResponseDto {
    message?: string;
    this_month_count: number;
    this_semester_count: number;
    range?: {
        start_date?: string;
        end_date?: string;
    };
    monthly_counts?: MonthlyCountRow[];
}

export interface AdminAnalyticsApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveAdminAnalyticsUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const base = String(AUTH_API_BASE_URL).replace(/\/+$/, "");
    const trimmedPath = path.replace(/^\/+/, "");
    return `${base}/${trimmedPath}`;
}

function buildQueryString(params?: Record<string, any>): string {
    if (!params) return "";
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || String(v).trim() === "") return;
        sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

function safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

async function adminAnalyticsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveAdminAnalyticsUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(init.headers),
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
        const message =
            body?.message ||
            body?.error ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const error = new Error(message) as AdminAnalyticsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * ✅ Admin analytics endpoint
 * GET /admin/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * Backend returns:
 * {
 *   message,
 *   this_month_count,
 *   this_semester_count,
 *   range: {start_date, end_date},
 *   monthly_counts: [{year, month, count}]
 * }
 */
export async function getAdminAnalyticsApi(query?: AnalyticsQuery): Promise<AdminAnalyticsResponseDto> {
    const qs = buildQueryString(query);

    const res = await adminAnalyticsFetch<any>(`/admin/analytics${qs}`, { method: "GET" });

    const monthly_counts: MonthlyCountRow[] = Array.isArray(res?.monthly_counts)
        ? res.monthly_counts.map((r: any) => ({
            year: safeNumber(r?.year),
            month: safeNumber(r?.month),
            count: safeNumber(r?.count),
        }))
        : [];

    return {
        message: res?.message,
        this_month_count: safeNumber(res?.this_month_count),
        this_semester_count: safeNumber(res?.this_semester_count),
        range: {
            start_date: res?.range?.start_date,
            end_date: res?.range?.end_date,
        },
        monthly_counts,
    };
}
