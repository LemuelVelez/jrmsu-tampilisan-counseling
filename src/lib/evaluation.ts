import type { IntakeRequestDto } from "@/api/intake/route";
import {
    getStudentEvaluationsApi,
    type GetStudentEvaluationsResponseDto,
    updateStudentEvaluationDetailsApi,
    type UpdateStudentEvaluationDetailsPayload,
} from "@/api/evaluation/route";

/**
 * Frontend type for a single evaluation entry.
 * (Backed by the `intake_requests` table.)
 */
export type StudentEvaluation = IntakeRequestDto;

/**
 * Payload when updating the `details` field of an evaluation.
 */
export type UpdateEvaluationDetailsPayload =
    UpdateStudentEvaluationDetailsPayload;

/**
 * High-level helper used by the React Evaluation page.
 * Wraps the lower-level API function.
 */
export async function fetchStudentEvaluations(): Promise<GetStudentEvaluationsResponseDto> {
    return getStudentEvaluationsApi();
}

/**
 * Update only the `details` field of a single evaluation.
 */
export async function updateEvaluationDetails(
    id: number | string,
    payload: UpdateEvaluationDetailsPayload,
): Promise<StudentEvaluation> {
    const response = await updateStudentEvaluationDetailsApi(id, payload);
    // Backend still returns { appointment: ... } for backwards compatibility.
    return response.appointment;
}
