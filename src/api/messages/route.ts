/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

/**
 * Sender role as stored in the database.
 * Includes guest so counselor inbox can display guest-authored messages.
 * Includes referral_user roles too (Dean/Registrar/Program Chair).
 */
export type MessageSenderApi =
    | "student"
    | "guest"
    | "counselor"
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
    recipient_role?: "student" | "guest" | "counselor" | "referral_user" | string | null;

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

async function messagesApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveMessagesApiUrl(path);

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

export interface CreateCounselorMessagePayload {
    content: string;
    recipient_role?: "student" | "guest" | "counselor" | "referral_user";
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
