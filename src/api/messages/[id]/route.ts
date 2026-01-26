import {
    markStudentMessagesReadApi,
    markCounselorMessagesReadApi,
    markReferralUserMessagesReadApi,
    type MarkMessagesReadResponseDto,
} from "../route";

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
 * Mark a single message as read for the current student/guest.
 */
export async function markStudentMessageReadByIdApi(
    id: number | string,
): Promise<MarkMessagesReadResponseDto> {
    const normalizedId = normalizeMessageId(id);

    return markStudentMessagesReadApi({
        message_ids: [normalizedId],
    });
}

/**
 * Mark a single message as read for the current counselor.
 */
export async function markCounselorMessageReadByIdApi(
    id: number | string,
): Promise<MarkMessagesReadResponseDto> {
    const normalizedId = normalizeMessageId(id);

    return markCounselorMessagesReadApi({
        message_ids: [normalizedId],
    });
}

/**
 * ✅ NEW: Mark a single message as read for the current referral user.
 */
export async function markReferralUserMessageReadByIdApi(
    id: number | string,
): Promise<MarkMessagesReadResponseDto> {
    const normalizedId = normalizeMessageId(id);

    return markReferralUserMessagesReadApi({
        message_ids: [normalizedId],
    });
}
