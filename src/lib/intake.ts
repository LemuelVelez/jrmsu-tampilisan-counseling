import {
    createIntakeRequestApi,
    createIntakeAssessmentApi,
    type CreateIntakeRequestPayload,
    type CreateIntakeRequestResponseDto,
    type CreateIntakeAssessmentPayload,
    type CreateIntakeAssessmentResponseDto,
} from "@/api/intake/route";

/**
 * Payload for the main counseling request (Step 4 – concern & schedule).
 */
export type IntakeRequestFormPayload = CreateIntakeRequestPayload;

/**
 * Backwards-compatible alias used by some existing code.
 */
export type IntakeFormPayload = IntakeRequestFormPayload;

/**
 * Payload for the assessment (Steps 1–3 – consent, demographics, MH status).
 */
export type IntakeAssessmentFormPayload = CreateIntakeAssessmentPayload;

/**
 * High-level helper used by the React intake page to submit the main
 * counseling request (Step 4).
 */
export async function submitIntakeRequest(
    payload: IntakeRequestFormPayload,
): Promise<CreateIntakeRequestResponseDto> {
    return createIntakeRequestApi(payload);
}

/**
 * High-level helper used by the React intake page to submit the
 * consent + assessment (Steps 1–3) to its own table.
 */
export async function submitIntakeAssessment(
    payload: IntakeAssessmentFormPayload,
): Promise<CreateIntakeAssessmentResponseDto> {
    return createIntakeAssessmentApi(payload);
}
