/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL } from "@/api/auth/route";

/**
 * Sender role as stored in the database.
 * The backend may store this as an enum or simple string.
 */
export type MessageSenderApi = "student" | "counselor" | "system" | string;

/**
 * DTO for a single message exchanged between the student and
 * the Guidance & Counseling Office.
 *
 * Intended to map 1:1 with the `messages` (or similar) table.
 */
export interface MessageDto {
    id: number | string;
    user_id: number | string;

    sender: MessageSenderApi;
    sender_name?: string | null;
    content: string;
    is_read: boolean | number;

    created_at: string;
    updated_at?: string;

    [key: string]: unknown;
}

/**
 * Response DTO for fetching all messages for the current student.
 */
export interface GetStudentMessagesResponseDto {
    message?: string;
    messages: MessageDto[];
}

/**
 * Payload for creating a new student-authored message.
 */
export interface CreateStudentMessagePayload {
    content: string;
}

/**
 * Response DTO after creating a new message.
 */
export interface CreateStudentMessageResponseDto {
    message?: string;
    messageRecord: MessageDto;
}

/**
 * Payload for marking one or more messages as read.
 * If `message_ids` is omitted or an empty array, the backend is
 * expected to mark *all* messages for the current student as read.
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

export interface MessagesApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveMessagesApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function messagesApiFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const url = resolveMessagesApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
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
 * Fetch all messages for the currently authenticated student.
 *
 * GET /student/messages
 */
export async function getStudentMessagesApi(): Promise<GetStudentMessagesResponseDto> {
    return messagesApiFetch<GetStudentMessagesResponseDto>("/student/messages", {
        method: "GET",
    });
}

/**
 * Create a new message authored by the current student.
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
 * Mark one or more messages as read for the current student.
 *
 * If `payload` is omitted or `message_ids` is an empty array,
 * the backend is expected to mark *all* messages as read.
 *
 * POST /student/messages/mark-as-read
 */
export async function markStudentMessagesReadApi(
    payload?: MarkMessagesReadPayload,
): Promise<MarkMessagesReadResponseDto> {
    const safePayload = payload ?? {};
    return messagesApiFetch<MarkMessagesReadResponseDto>(
        "/student/messages/mark-as-read",
        {
            method: "POST",
            body: JSON.stringify(safePayload),
        },
    );
}
