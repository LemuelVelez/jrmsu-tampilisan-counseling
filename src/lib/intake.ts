import {
    createIntakeRequestApi,
    type CreateIntakeRequestPayload,
    type CreateIntakeRequestResponseDto,
} from "@/api/intake/route";

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
