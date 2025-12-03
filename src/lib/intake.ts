import {
    createIntakeRequestApi,
    type CreateIntakeRequestPayload,
    type CreateIntakeRequestResponseDto,
} from "@/api/intake/route";

/**
 * Payload shape used by the student intake form.
 *
 * This mirrors the backend API and includes:
 *  - core scheduling info (concern_type, urgency, preferred_date/time, details)
 *  - consent flag
 *  - demographic snapshot (name, age, gender, living situation, etc.)
 *  - mental health questionnaire responses
 */
export type IntakeFormPayload = CreateIntakeRequestPayload;

/**
 * High-level helper used by the React intake page.
 * Wraps the lower-level API function.
 */
export async function submitIntakeRequest(
    payload: IntakeFormPayload,
): Promise<CreateIntakeRequestResponseDto> {
    return createIntakeRequestApi(payload);
}
