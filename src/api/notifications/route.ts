/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

export interface NotificationCountsDto {
    unread_messages: number;
    pending_appointments: number;
    new_referrals: number;

    // optional
    [key: string]: unknown;
}

export interface NotificationCountsResponseDto {
    message?: string;
    counts: NotificationCountsDto;
}

export interface NotificationsApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveNotificationsApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function notificationsApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveNotificationsApiUrl(path);

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

        const error = new Error(message) as NotificationsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * ✅ Notification counters endpoint
 *
 * Backend recommended:
 * GET /notifications/counts
 *
 * Returns counts for the logged-in role:
 * - student: unread_messages
 * - counselor: unread_messages + pending_appointments + new_referrals
 * - referral_user: unread_messages + new_referrals
 */
export async function getNotificationCountsApi(): Promise<NotificationCountsResponseDto> {
    const res = await notificationsApiFetch<any>("/notifications/counts", {
        method: "GET",
    });

    // accept either {counts:{...}} or direct fields
    const counts = (res?.counts ?? res) as any;

    return {
        message: res?.message,
        counts: {
            unread_messages: Number(counts?.unread_messages ?? 0),
            pending_appointments: Number(counts?.pending_appointments ?? 0),
            new_referrals: Number(counts?.new_referrals ?? 0),
        },
    };
}
