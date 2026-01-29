/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

/**
 * Admin Messages API
 * - GET    /admin/messages
 * - POST   /admin/messages                 ✅ NEW (send)
 * - GET    /admin/messages/conversations/{conversationId}
 * - DELETE /admin/messages/conversations/{conversationId}?force=0|1
 * - PATCH  /admin/messages/{id}
 * - DELETE /admin/messages/{id}
 */

export interface AdminMessagesApiError extends Error {
    status?: number;
    data?: unknown;
}

export interface AdminPaginationDto {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
}

export interface AdminMessageDto {
    id: number | string;
    conversation_id?: number | string;

    content: string;
    created_at: string;
    updated_at?: string;

    sender: string;
    sender_id?: number | string | null;
    sender_name?: string | null;
    sender_email?: string | null;
    sender_role?: string | null;
    sender_avatar_url?: string | null;

    recipient_id?: number | string | null;
    recipient_role?: string | null;
    recipient_name?: string | null;
    recipient_email?: string | null;
    recipient_user_role?: string | null;
    recipient_avatar_url?: string | null;

    owner_user_id?: number | string | null;
    owner_name?: string | null;
    owner_email?: string | null;
    owner_role?: string | null;
    owner_avatar_url?: string | null;

    is_read?: boolean | number;
    counselor_is_read?: boolean | number;
    student_read_at?: string | null;
    counselor_read_at?: string | null;

    [key: string]: unknown;
}

export interface AdminConversationDto {
    conversation_id: number | string;
    last_message: AdminMessageDto;
}

export interface GetAdminConversationsResponseDto {
    message?: string;
    conversations: AdminConversationDto[];
    pagination: AdminPaginationDto;
}

export interface GetAdminConversationMessagesResponseDto {
    message?: string;
    conversation_id: number | string;
    deleted_at?: string | null;
    messages: AdminMessageDto[];
    pagination: AdminPaginationDto;
}

export interface UpdateAdminMessagePayload {
    content: string;
}

export interface UpdateAdminMessageResponseDto {
    message?: string;
    data: {
        id: number | string;
        conversation_id?: number | string;
        content: string;
        updated_at?: string;
        [key: string]: unknown;
    };
}

/**
 * ✅ NEW: Create (send) admin message
 * (admin can send to any user by role + id)
 */
export interface CreateAdminMessagePayload {
    content: string;
    recipient_role?: string;
    recipient_id?: number | string;
    conversation_id?: number | string;
}

export interface CreateAdminMessageResponseDto {
    message?: string;
    // backend may return any of these shapes (we keep it flexible)
    messageRecord?: AdminMessageDto;
    data?: AdminMessageDto;
    record?: AdminMessageDto;
    [key: string]: unknown;
}

function resolveAdminMessagesApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function adminMessagesApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveAdminMessagesApiUrl(path);

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

        const error = new Error(message) as AdminMessagesApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

function buildQuery(params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        const s = String(v).trim();
        if (!s) return;
        qs.set(k, s);
    });
    const out = qs.toString();
    return out ? `?${out}` : "";
}

/**
 * GET /admin/messages
 */
export async function getAdminConversationsApi(args?: {
    page?: number;
    per_page?: number;
    search?: string;
}): Promise<GetAdminConversationsResponseDto> {
    const query = buildQuery({
        page: args?.page,
        per_page: args?.per_page,
        search: args?.search,
    });

    return adminMessagesApiFetch<GetAdminConversationsResponseDto>(`/admin/messages${query}`, {
        method: "GET",
    });
}

/**
 * ✅ NEW
 * POST /admin/messages
 */
export async function createAdminMessageApi(
    payload: CreateAdminMessagePayload,
): Promise<CreateAdminMessageResponseDto> {
    return adminMessagesApiFetch<CreateAdminMessageResponseDto>(`/admin/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * GET /admin/messages/conversations/{conversationId}
 */
export async function getAdminConversationMessagesApi(
    conversationId: number | string,
    args?: { page?: number; per_page?: number },
): Promise<GetAdminConversationMessagesResponseDto> {
    const safeId = encodeURIComponent(String(conversationId));
    const query = buildQuery({
        page: args?.page,
        per_page: args?.per_page,
    });

    return adminMessagesApiFetch<GetAdminConversationMessagesResponseDto>(
        `/admin/messages/conversations/${safeId}${query}`,
        { method: "GET" },
    );
}

/**
 * DELETE /admin/messages/conversations/{conversationId}?force=0|1
 */
export async function deleteAdminConversationApi(
    conversationId: number | string,
    args?: { force?: boolean },
): Promise<{ message?: string; conversation_id: number | string; deleted_at?: string;[key: string]: unknown }> {
    const safeId = encodeURIComponent(String(conversationId));
    const query = buildQuery({
        force: args?.force ? 1 : 0,
    });

    return adminMessagesApiFetch(`/admin/messages/conversations/${safeId}${query}`, {
        method: "DELETE",
    });
}

/**
 * PATCH /admin/messages/{id}
 */
export async function updateAdminMessageApi(
    id: number | string,
    payload: UpdateAdminMessagePayload,
): Promise<UpdateAdminMessageResponseDto> {
    const safeId = encodeURIComponent(String(id));

    return adminMessagesApiFetch<UpdateAdminMessageResponseDto>(`/admin/messages/${safeId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

/**
 * DELETE /admin/messages/{id}
 */
export async function deleteAdminMessageApi(
    id: number | string,
): Promise<{ message?: string; id: number | string;[key: string]: unknown }> {
    const safeId = encodeURIComponent(String(id));

    return adminMessagesApiFetch(`/admin/messages/${safeId}`, {
        method: "DELETE",
    });
}
