import {
    getCounselorCaseLoadApi,
    getStudentManualScoresApi,
    saveManualScoreApi,
    type CaseLoadStudentDto,
    type ManualAssessmentScoreDto,
    type SaveManualScorePayload,
} from "@/api/manual-scores/route";

export type CaseLoadStudent = CaseLoadStudentDto;
export type ManualScoreRecord = ManualAssessmentScoreDto;

export async function fetchCounselorCaseLoad(): Promise<CaseLoadStudentDto[]> {
    const res = await getCounselorCaseLoadApi();
    return res.students;
}

export async function saveManualAssessmentScore(payload: SaveManualScorePayload): Promise<ManualAssessmentScoreDto> {
    const res = await saveManualScoreApi(payload);
    return res.record;
}

export async function fetchStudentManualScores(studentId: number | string): Promise<ManualAssessmentScoreDto[]> {
    const res = await getStudentManualScoresApi(studentId);
    return res.scores;
}
