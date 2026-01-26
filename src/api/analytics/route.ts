/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

export interface AnalyticsQuery {
    start_date?: string; // YYYY-MM-DD
    end_date?: string; // YYYY-MM-DD
}

export interface AnalyticsSummaryDto {
    this_month_count: number;
    this_semester_count: number;
    range_count?: number;

    /**
     * Optional chart series
     * Example: [{ label: "Jan", count: 12 }, ...]
     */
    series?: Array<{ label: string; count: number }>;

    [key: string]: unknown;
}

export interface CounselorAnalyticsResponseDto {
    message?: string;
    analytics: AnalyticsSummaryDto;
}

export interface AnalyticsApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveAnalyticsApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

function buildQueryString(params?: Record<string, any>): string {
    if (!params) return "";
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

async function analyticsApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveAnalyticsApiUrl(path);

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

        const error = new Error(message) as AnalyticsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * ✅ Counselor analytics endpoint
 * GET /counselor/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export async function getCounselorAnalyticsApi(query?: AnalyticsQuery): Promise<CounselorAnalyticsResponseDto> {
    const qs = buildQueryString(query);

    const res = await analyticsApiFetch<any>(`/counselor/analytics${qs}`, { method: "GET" });

    const analytics = (res?.analytics ?? res?.data ?? res) as any;

    return {
        message: res?.message,
        analytics: {
            this_month_count: Number(analytics?.this_month_count ?? analytics?.month_count ?? 0),
            this_semester_count: Number(analytics?.this_semester_count ?? analytics?.semester_count ?? 0),
            range_count:
                analytics?.range_count != null ? Number(analytics.range_count) : undefined,
            series: Array.isArray(analytics?.series) ? analytics.series : undefined,
        },
    };
}
