import {
    markStudentMessagesReadApi,
    type MarkMessagesReadResponseDto,
} from "../route";

/**
 * Helper for operations on a single message record, identified by ID.
 *
 * This file is a small wrapper around the bulk mark-as-read endpoint:
 *   POST /student/messages/mark-as-read
 *
 * It is used by the student Messages page to mark one message as read
 * when the user clicks the "NEW" badge.
 */

/**
 * Normalize a message ID into a valid integer.
 * Throws if the value cannot be safely interpreted as an integer.
 */
function normalizeMessageId(id: number | string): number {
    if (typeof id === "number") {
        if (!Number.isInteger(id)) {
            throw new Error("Message ID must be an integer.");
        }
        return id;
    }

    const parsed = Number.parseInt(id, 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error("Message ID must be a valid integer.");
    }

    return parsed;
}

/**
 * Mark a single message as read for the current student.
 *
 * Internally this calls:
 *   POST /student/messages/mark-as-read
 * with:
 *   { "message_ids": [id] }
 *
 * It guarantees that the ID sent to Laravel is an integer, which
 * avoids the "message_ids.0 field must be an integer" validation error.
 */
export async function markStudentMessageReadByIdApi(
    id: number | string,
): Promise<MarkMessagesReadResponseDto> {
    const normalizedId = normalizeMessageId(id);

    return markStudentMessagesReadApi({
        message_ids: [normalizedId],
    });
}
