/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL } from "@/api/auth/route";

/**
 * Sender role as stored in the database.
 * Includes guest so counselor inbox can display guest-authored messages.
 */
export type MessageSenderApi = "student" | "guest" | "counselor" | "system" | string;

/**
 * A generic message DTO used by both student and counselor message endpoints.
 * The backend may include more fields; we keep this flexible.
 */
export interface MessageDto {
    id: number | string;

    /**
     * Depending on backend implementation, this may represent the student/guest user
     * or the message owner/peer.
     */
    user_id?: number | string;

    /**
     * Helpful for threading / ownership checks in UI.
     */
    sender_id?: number | string | null;

    sender: MessageSenderApi;
    sender_name?: string | null;

    content: string;

    /**
     * Some backends store as boolean, others as 0/1.
     */
    is_read: boolean | number;

    created_at: string;
    updated_at?: string;

    /**
     * Optional fields for threading/conversations (backend-dependent)
     */
    conversation_id?: number | string;
    recipient_id?: number | string | null;
    recipient_role?: "student" | "guest" | "counselor" | string | null;

    message_type?: string;

    [key: string]: unknown;
}

/** -----------------------------
 * Student (and Guest) Endpoints
 * ------------------------------*/

/**
 * Response DTO for fetching all messages for the current student/guest.
 */
export interface GetStudentMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

/**
 * Payload for creating a new student-authored message.
 *
 * Updated to match the dashboard student UI:
 * - can include recipient_role/recipient_id (student -> counselor)
 * - can include conversation_id (thread hint; backend may ignore/replace)
 */
export interface CreateStudentMessagePayload {
    content: string;
    recipient_role?: "counselor" | "student" | "guest";
    recipient_id?: number | string;
    conversation_id?: number | string;
}

/**
 * Response DTO after creating a new message (student/guest).
 */
export interface CreateStudentMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
}

/**
 * Payload for marking one or more messages as read.
 * If `message_ids` is omitted or an empty array, backend is expected to mark all.
 */
export interface MarkMessagesReadPayload {
    message_ids?: Array<number | string>;
}

/**
 * Response DTO after marking messages as read.
 */
export interface MarkMessagesReadResponseDto {
    message?: string;
    updated_count?: number;
}

/** -----------------------------
 * Counselor Endpoints
 * ------------------------------*/

/**
 * Counselor inbox response.
 */
export interface GetCounselorMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

/**
 * Counselor message payload.
 * Matches counselor UI:
 * - recipient_role + recipient_id required by UI flow
 * - conversation_id included as a hint; backend may ignore/replace
 */
export interface CreateCounselorMessagePayload {
    content: string;
    recipient_role?: "student" | "guest" | "counselor";
    recipient_id?: number | string;
    conversation_id?: number | string;
}

/**
 * Counselor create message response.
 */
export interface CreateCounselorMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
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

    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
    };

    // Only set JSON content-type if we actually have a body
    if (init.body != null && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
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

/**
 * Fetch all messages for the currently authenticated student/guest.
 *
 * GET /student/messages
 */
export async function getStudentMessagesApi(): Promise<GetStudentMessagesResponseDto> {
    return messagesApiFetch<GetStudentMessagesResponseDto>("/student/messages", {
        method: "GET",
    });
}

/**
 * Create a new message authored by the current student/guest.
 *
 * POST /student/messages
 */
export async function createStudentMessageApi(
    payload: CreateStudentMessagePayload,
): Promise<CreateStudentMessageResponseDto> {
    return messagesApiFetch<CreateStudentMessageResponseDto>("/student/messages", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Mark one or more messages as read for the current student/guest.
 *
 * POST /student/messages/mark-as-read
 */
export async function markStudentMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>("/student/messages/mark-as-read", {
        method: "POST",
        body: JSON.stringify(safePayload),
    });
}

/**
 * Fetch counselor inbox messages.
 *
 * GET /counselor/messages
 */
export async function getCounselorMessagesApi(): Promise<GetCounselorMessagesResponseDto> {
    return messagesApiFetch<GetCounselorMessagesResponseDto>("/counselor/messages", {
        method: "GET",
    });
}

/**
 * Counselor sends a message to a student/guest/counselor.
 *
 * POST /counselor/messages
 */
export async function createCounselorMessageApi(
    payload: CreateCounselorMessagePayload,
): Promise<CreateCounselorMessageResponseDto> {
    return messagesApiFetch<CreateCounselorMessageResponseDto>("/counselor/messages", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Counselor marks messages as read (bulk).
 *
 * POST /counselor/messages/mark-as-read
 */
export async function markCounselorMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>("/counselor/messages/mark-as-read", {
        method: "POST",
        body: JSON.stringify(safePayload),
    });
}
