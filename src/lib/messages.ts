import {
    // Student/Guest APIs
    getStudentMessagesApi,
    createStudentMessageApi,
    markStudentMessagesReadApi,

    // Counselor APIs
    getCounselorMessagesApi,
    createCounselorMessageApi,
    markCounselorMessagesReadApi,

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
} from "@/api/messages/route";

/**
 * Convenience type aliases for use in React components.
 */
export type StudentMessage = MessageDto;
export type CounselorMessage = MessageDto;

export type GetStudentMessagesResult = GetStudentMessagesResponseDto;
export type GetCounselorMessagesResult = GetCounselorMessagesResponseDto;

export type SendStudentMessagePayload = CreateStudentMessagePayload;
export type SendCounselorMessagePayload = CreateCounselorMessagePayload;

/**
 * High-level helper to fetch all messages for the current student/guest.
 */
export async function fetchStudentMessages(): Promise<GetStudentMessagesResponseDto> {
    return getStudentMessagesApi();
}

/**
 * High-level helper for sending a new message from the student/guest.
 *
 * Accepts either a full payload object or a simple string `content`.
 */
export async function sendStudentMessage(
    input: string | SendStudentMessagePayload,
): Promise<CreateStudentMessageResponseDto> {
    const payload: CreateStudentMessagePayload =
        typeof input === "string" ? { content: input } : input;

    return createStudentMessageApi(payload);
}

/**
 * High-level helper to mark one or more messages as read (student/guest).
 *
 * If `messageIds` is omitted or empty, backend should mark all messages as read.
 */
export async function markStudentMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0 ? { message_ids: messageIds } : undefined;

    return markStudentMessagesReadApi(payload);
}

/**
 * High-level helper to fetch counselor inbox messages.
 *
 * Note: This is ready for counselor UI integration (threads/pagination later).
 */
export async function fetchCounselorMessages(): Promise<GetCounselorMessagesResponseDto> {
    return getCounselorMessagesApi();
}

/**
 * High-level helper for sending a new message as counselor.
 *
 * Accepts either:
 * - string content
 * - or a payload with optional recipient/conversation fields
 */
export async function sendCounselorMessage(
    input: string | SendCounselorMessagePayload,
): Promise<CreateCounselorMessageResponseDto> {
    const payload: CreateCounselorMessagePayload =
        typeof input === "string" ? { content: input } : input;

    return createCounselorMessageApi(payload);
}

/**
 * High-level helper to mark counselor messages as read.
 *
 * If `messageIds` is omitted or empty, backend should mark all counselor messages as read.
 */
export async function markCounselorMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0 ? { message_ids: messageIds } : undefined;

    return markCounselorMessagesReadApi(payload);
}
