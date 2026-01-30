/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";
import { getCurrentSession } from "@/lib/authentication";

/**
 * Sender role as stored in the database.
 * Includes guest so counselor inbox can display guest-authored messages.
 * Includes referral_user roles too (Dean/Registrar/Program Chair).
 * ✅ UPDATED: include admin so counselor can converse with admins.
 */
export type MessageSenderApi =
    | "student"
    | "guest"
    | "counselor"
    | "admin"
    | "system"
    | "referral_user"
    | "dean"
    | "registrar"
    | "program_chair"
    | string;

export interface MessageDto {
    id: number | string;

    user_id?: number | string;
    sender_id?: number | string | null;

    sender: MessageSenderApi;

    sender_name?: string | null;

    recipient_name?: string | null;

    user_name?: string | null;

    content: string;

    is_read: boolean | number;

    created_at: string;
    updated_at?: string;

    conversation_id?: number | string;
    recipient_id?: number | string | null;

    /**
     * ✅ UPDATED: include admin
     */
    recipient_role?: "student" | "guest" | "counselor" | "admin" | "referral_user" | string | null;

    message_type?: string;

    [key: string]: unknown;
}

export interface MarkMessagesReadPayload {
    message_ids?: Array<number | string>;
}

export interface MarkMessagesReadResponseDto {
    message?: string;
    updated_count?: number;
}

export interface MessagesApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveMessagesApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

/**
 * Normalize tokens to avoid accidental:
 * - "Bearer Bearer <token>"
 * - "bearer <token>" stored in local/session storage
 * - "null"/"undefined" strings
 */
function normalizeAuthTokenValue(raw: unknown): string | null {
    const s =
        typeof raw === "string"
            ? raw
            : raw == null
                ? ""
                : String(raw);

    const t = s.trim();
    if (!t) return null;

    const low = t.toLowerCase();
    if (low === "undefined" || low === "null") return null;

    // If caller stored "Bearer <token>", strip it here.
    return t.replace(/^bearer\s+/i, "").trim() || null;
}

function tryReadTokenFromSessionObject(session: any): string | null {
    if (!session) return null;

    // common top-level fields
    const direct =
        session?.token ??
        session?.access_token ??
        session?.accessToken ??
        session?.auth_token ??
        session?.authToken ??
        null;

    const v1 = normalizeAuthTokenValue(direct);
    if (v1) return v1;

    // common nested fields
    const nested =
        session?.user?.token ??
        session?.user?.access_token ??
        session?.user?.accessToken ??
        session?.data?.token ??
        session?.data?.access_token ??
        session?.data?.accessToken ??
        null;

    const v2 = normalizeAuthTokenValue(nested);
    if (v2) return v2;

    return null;
}

function tryReadTokenFromStorage(storage: Storage | null | undefined): string | null {
    if (!storage) return null;

    // common direct keys
    const directKeys = [
        "token",
        "access_token",
        "accessToken",
        "auth_token",
        "authToken",
        "bearer_token",
        "bearerToken",
    ];

    for (const k of directKeys) {
        const v = normalizeAuthTokenValue(storage.getItem(k));
        if (v) return v;
    }

    // common JSON session keys
    const jsonKeys = [
        "session",
        "auth_session",
        "authSession",
        "user_session",
        "userSession",
        "current_session",
        "currentSession",
    ];

    for (const k of jsonKeys) {
        const raw = storage.getItem(k);
        if (!raw) continue;

        try {
            const parsed = JSON.parse(raw);
            const v = tryReadTokenFromSessionObject(parsed);
            if (v) return v;
        } catch {
            // ignore
        }
    }

    // last resort: scan token-like keys (lightweight)
    try {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key) continue;

            const low = key.toLowerCase();
            if (!low.includes("token")) continue;

            const v = normalizeAuthTokenValue(storage.getItem(key));
            if (v) return v;
        }
    } catch {
        // ignore
    }

    return null;
}

/**
 * ✅ FIX (401 Unauthorized):
 * Automatically attach Bearer token from the current session when available.
 * ALSO handles tokens that are already stored with "Bearer " prefix.
 */
function readAuthToken(): string | null {
    // 1) Primary: your app session helper
    try {
        const session: any = getCurrentSession();
        const v = tryReadTokenFromSessionObject(session);
        if (v) return v;
    } catch {
        // ignore
    }

    // 2) Fallback: storage (some apps persist token directly)
    if (typeof window !== "undefined") {
        const v1 = tryReadTokenFromStorage(window.sessionStorage);
        if (v1) return v1;

        const v2 = tryReadTokenFromStorage(window.localStorage);
        if (v2) return v2;
    }

    return null;
}

function normalizeAuthorizationHeaderValue(raw: string | null): string | null {
    const v = normalizeAuthTokenValue(raw);
    return v ? `Bearer ${v}` : null;
}

async function messagesApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveMessagesApiUrl(path);

    // buildJsonHeaders may return a plain object or HeadersInit; normalize to Headers so we can .has()
    const headers = new Headers(buildJsonHeaders(init.headers));

    // Ensure Accept is always present
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    // Helpful for many Laravel setups
    if (!headers.has("X-Requested-With")) headers.set("X-Requested-With", "XMLHttpRequest");

    // If caller already provided Authorization, normalize it (avoid Bearer Bearer)
    if (headers.has("Authorization")) {
        const normalized = normalizeAuthorizationHeaderValue(headers.get("Authorization"));
        if (normalized) headers.set("Authorization", normalized);
        else headers.delete("Authorization");
    }

    // Only set Authorization if caller didn't explicitly pass one
    if (!headers.has("Authorization")) {
        const token = readAuthToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, {
        ...init,
        headers,
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

        const error = new Error(message) as MessagesApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/** -----------------------------
 * Student (and Guest) Endpoints
 * ------------------------------*/

export interface GetStudentMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

export interface CreateStudentMessagePayload {
    content: string;
    recipient_role?: "counselor" | "student" | "guest" | "referral_user";
    recipient_id?: number | string;
    conversation_id?: number | string;
}

export interface CreateStudentMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
}

export async function getStudentMessagesApi(): Promise<GetStudentMessagesResponseDto> {
    return messagesApiFetch<GetStudentMessagesResponseDto>("/student/messages", {
        method: "GET",
    });
}

export async function createStudentMessageApi(
    payload: CreateStudentMessagePayload,
): Promise<CreateStudentMessageResponseDto> {
    return messagesApiFetch<CreateStudentMessageResponseDto>("/student/messages", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function markStudentMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>("/student/messages/mark-as-read", {
        method: "POST",
        body: JSON.stringify(safePayload),
    });
}

/** -----------------------------
 * Counselor Endpoints
 * ------------------------------*/

export interface GetCounselorMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

/**
 * ✅ UPDATED:
 * counselor can message: student, guest, counselor, admin, referral_user
 */
export interface CreateCounselorMessagePayload {
    content: string;
    recipient_role?: "student" | "guest" | "counselor" | "admin" | "referral_user";
    recipient_id?: number | string;
    conversation_id?: number | string;
}

export interface CreateCounselorMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
}

export async function getCounselorMessagesApi(): Promise<GetCounselorMessagesResponseDto> {
    return messagesApiFetch<GetCounselorMessagesResponseDto>("/counselor/messages", {
        method: "GET",
    });
}

export async function createCounselorMessageApi(
    payload: CreateCounselorMessagePayload,
): Promise<CreateCounselorMessageResponseDto> {
    return messagesApiFetch<CreateCounselorMessageResponseDto>("/counselor/messages", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function markCounselorMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>("/counselor/messages/mark-as-read", {
        method: "POST",
        body: JSON.stringify(safePayload),
    });
}

/** -----------------------------
 * Referral User Endpoints (NEW)
 * Dean / Registrar / Program Chair
 * ------------------------------*/

export interface GetReferralUserMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

/**
 * ✅ Referral users can ONLY message counselors.
 * recipient_id is required.
 */
export interface CreateReferralUserMessagePayload {
    content: string;
    recipient_id: number | string;
    recipient_role?: "counselor";
    conversation_id?: number | string;
}

export interface CreateReferralUserMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
}

export async function getReferralUserMessagesApi(): Promise<GetReferralUserMessagesResponseDto> {
    return messagesApiFetch<GetReferralUserMessagesResponseDto>("/referral-user/messages", {
        method: "GET",
    });
}

export async function createReferralUserMessageApi(
    payload: CreateReferralUserMessagePayload,
): Promise<CreateReferralUserMessageResponseDto> {
    return messagesApiFetch<CreateReferralUserMessageResponseDto>("/referral-user/messages", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function markReferralUserMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>("/referral-user/messages/mark-as-read", {
        method: "POST",
        body: JSON.stringify(safePayload),
    });
}
