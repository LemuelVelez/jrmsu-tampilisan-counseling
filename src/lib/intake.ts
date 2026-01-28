import {
    createIntakeRequestApi,
    createIntakeAssessmentApi,
    getStudentAssessmentsApi,
    getCounselorAssessmentsApi,
    type CreateIntakeRequestPayload,
    type CreateIntakeRequestResponseDto,
    type CreateIntakeAssessmentPayload,
    type CreateIntakeAssessmentResponseDto,
    type GetStudentAssessmentsResponseDto,
    type IntakeAssessmentDto,
    type CounselorAssessmentRecordDto,
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
 * Convenience types for the student's assessment history.
 */
export type StudentAssessment = IntakeAssessmentDto;
export type GetStudentAssessmentsResult = GetStudentAssessmentsResponseDto;

/**
 * ✅ Counselor assessment record (with optional user relation) used by reports.
 */
export type CounselorAssessmentRecord = CounselorAssessmentRecordDto;

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

/**
 * High-level helper to fetch the student's assessment history.
 * Used by the Evaluation page to show past assessments.
 */
export async function fetchStudentAssessments(): Promise<GetStudentAssessmentsResponseDto> {
    return getStudentAssessmentsApi();
}

/**
 * ✅ Counselor: fetch all assessments for reports
 */
export async function fetchCounselorAssessments(): Promise<CounselorAssessmentRecordDto[]> {
    const res = await getCounselorAssessmentsApi();
    return res.assessments ?? [];
}
