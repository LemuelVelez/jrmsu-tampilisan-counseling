/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    // Student/Guest APIs
    getStudentMessagesApi,
    createStudentMessageApi,
    markStudentMessagesReadApi,

    // Counselor APIs
    getCounselorMessagesApi,
    createCounselorMessageApi,
    markCounselorMessagesReadApi,

    // Referral User APIs
    getReferralUserMessagesApi,
    createReferralUserMessageApi,
    markReferralUserMessagesReadApi,

    // Types
    type MessageDto,
    type GetStudentMessagesResponseDto,
    type CreateStudentMessagePayload,
    type CreateStudentMessageResponseDto,
    type MarkMessagesReadPayload,
    type MarkMessagesReadResponseDto,
    type GetCounselorMessagesResponseDto,
    type CreateCounselorMessagePayload,
    type CreateCounselorMessageResponseDto,
    type GetReferralUserMessagesResponseDto,
    type CreateReferralUserMessagePayload,
    type CreateReferralUserMessageResponseDto,
} from "@/api/messages/route";

import {
    getAdminConversationsApi,
    getAdminConversationMessagesApi,
    deleteAdminConversationApi,
    updateAdminMessageApi,
    deleteAdminMessageApi,
    // ✅ NEW (send)
    createAdminMessageApi,
    type CreateAdminMessagePayload,
    type CreateAdminMessageResponseDto,

    type AdminConversationDto,
    type AdminMessageDto,
    type GetAdminConversationsResponseDto,
    type GetAdminConversationMessagesResponseDto,
    type UpdateAdminMessageResponseDto,
} from "@/api/admin/messages/route";

/**
 * Convenience type aliases for use in React components.
 */
export type StudentMessage = MessageDto;
export type CounselorMessage = MessageDto;
export type ReferralUserMessage = MessageDto;

export type GetStudentMessagesResult = GetStudentMessagesResponseDto;
export type GetCounselorMessagesResult = GetCounselorMessagesResponseDto;
export type GetReferralUserMessagesResult = GetReferralUserMessagesResponseDto;

export type SendStudentMessagePayload = CreateStudentMessagePayload;
export type SendCounselorMessagePayload = CreateCounselorMessagePayload;
export type SendReferralUserMessagePayload = CreateReferralUserMessagePayload;

/**
 * Fetch all messages for the current student/guest.
 */
export async function fetchStudentMessages(): Promise<GetStudentMessagesResponseDto> {
    return getStudentMessagesApi();
}

/**
 * Send a message from student/guest.
 */
export async function sendStudentMessage(
    input: string | SendStudentMessagePayload,
): Promise<CreateStudentMessageResponseDto> {
    const payload: CreateStudentMessagePayload = typeof input === "string" ? { content: input } : input;
    return createStudentMessageApi(payload);
}

/**
 * Mark messages as read (student/guest).
 */
export async function markStudentMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0 ? { message_ids: messageIds } : undefined;

    return markStudentMessagesReadApi(payload);
}

/**
 * Fetch counselor inbox messages.
 */
export async function fetchCounselorMessages(): Promise<GetCounselorMessagesResponseDto> {
    return getCounselorMessagesApi();
}

/**
 * Send counselor message.
 */
export async function sendCounselorMessage(
    input: string | SendCounselorMessagePayload,
): Promise<CreateCounselorMessageResponseDto> {
    const payload: CreateCounselorMessagePayload = typeof input === "string" ? { content: input } : input;
    return createCounselorMessageApi(payload);
}

/**
 * Mark counselor messages as read.
 */
export async function markCounselorMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0 ? { message_ids: messageIds } : undefined;

    return markCounselorMessagesReadApi(payload);
}

/**
 * ✅ NEW: Fetch referral user inbox messages.
 */
export async function fetchReferralUserMessages(): Promise<GetReferralUserMessagesResponseDto> {
    return getReferralUserMessagesApi();
}

/**
 * ✅ NEW: Send message as referral user (Dean/Registrar/Program Chair).
 */
export async function sendReferralUserMessage(
    input: string | SendReferralUserMessagePayload,
): Promise<CreateReferralUserMessageResponseDto> {
    const payload: CreateReferralUserMessagePayload = typeof input === "string" ? { content: input } : input;
    return createReferralUserMessageApi(payload);
}

/**
 * ✅ NEW: Mark referral user messages as read.
 */
export async function markReferralUserMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0 ? { message_ids: messageIds } : undefined;

    return markReferralUserMessagesReadApi(payload);
}

/* ---------------------------------------
 * ✅ Admin Messages (NEW)
 * --------------------------------------*/

export type AdminMessage = AdminMessageDto;
export type AdminConversationSummary = AdminConversationDto;

export async function fetchAdminMessageConversations(args?: {
    page?: number;
    per_page?: number;
    search?: string;
}): Promise<GetAdminConversationsResponseDto> {
    return getAdminConversationsApi(args);
}

export async function fetchAdminConversationMessages(
    conversationId: number | string,
    args?: { page?: number; per_page?: number },
): Promise<GetAdminConversationMessagesResponseDto> {
    return getAdminConversationMessagesApi(conversationId, args);
}

export async function deleteAdminConversation(
    conversationId: number | string,
    args?: { force?: boolean },
): Promise<{ message?: string; conversation_id: number | string; deleted_at?: string;[key: string]: unknown }> {
    return deleteAdminConversationApi(conversationId, args);
}

export async function updateAdminMessage(
    id: number | string,
    content: string,
): Promise<UpdateAdminMessageResponseDto> {
    return updateAdminMessageApi(id, { content });
}

export async function deleteAdminMessage(
    id: number | string,
): Promise<{ message?: string; id: number | string;[key: string]: unknown }> {
    return deleteAdminMessageApi(id);
}

/**
 * ✅ NEW: Send message as admin (admin can message any user).
 * Backend endpoint: POST /admin/messages
 */
export type SendAdminMessagePayload = CreateAdminMessagePayload;

export async function sendAdminMessage(
    input: string | SendAdminMessagePayload,
): Promise<CreateAdminMessageResponseDto> {
    const payload: CreateAdminMessagePayload = typeof input === "string" ? ({ content: input } as any) : input;
    return createAdminMessageApi(payload);
}
