import {
    getStudentMessagesApi,
    createStudentMessageApi,
    markStudentMessagesReadApi,
    type MessageDto,
    type GetStudentMessagesResponseDto,
    type CreateStudentMessagePayload,
    type CreateStudentMessageResponseDto,
    type MarkMessagesReadPayload,
    type MarkMessagesReadResponseDto,
} from "@/api/messages/route";

/**
 * Convenience type aliases for use in React components.
 */
export type StudentMessage = MessageDto;
export type GetStudentMessagesResult = GetStudentMessagesResponseDto;
export type SendStudentMessagePayload = CreateStudentMessagePayload;

/**
 * High-level helper to fetch all messages for the current student.
 */
export async function fetchStudentMessages(): Promise<GetStudentMessagesResponseDto> {
    return getStudentMessagesApi();
}

/**
 * High-level helper for sending a new message from the student.
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
 * High-level helper to mark one or more messages as read.
 *
 * If `messageIds` is omitted or empty, the backend should mark
 * all messages for the current student as read.
 */
export async function markStudentMessagesAsRead(
    messageIds?: Array<number | string>,
): Promise<MarkMessagesReadResponseDto> {
    const payload: MarkMessagesReadPayload | undefined =
        messageIds && messageIds.length > 0
            ? { message_ids: messageIds }
            : undefined;

    return markStudentMessagesReadApi(payload);
}
