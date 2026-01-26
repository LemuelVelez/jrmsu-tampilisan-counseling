/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

export type ManualScoreRatingApi = "poor" | "fair" | "good" | "very_good" | string;

export interface ManualAssessmentScoreDto {
    id: number | string;

    student_id: number | string;
    counselor_id: number | string;

    score: number;
    rating: ManualScoreRatingApi;

    date: string; // YYYY-MM-DD
    remarks?: string | null;

    created_at?: string;
    updated_at?: string;

    [key: string]: unknown;
}

export interface CaseLoadStudentDto {
    id: number | string;
    name?: string | null;
    email?: string | null;

    student_id?: string | null;
    program?: string | null;
    year_level?: string | null;

    [key: string]: unknown;
}

export interface GetCaseLoadResponseDto {
    message?: string;
    students: CaseLoadStudentDto[];
}

export interface SaveManualScorePayload {
    student_id: number | string;
    score: number;
    date: string; // YYYY-MM-DD
    remarks?: string;
}

export interface SaveManualScoreResponseDto {
    message?: string;
    record: ManualAssessmentScoreDto;
}

export interface GetStudentManualScoresResponseDto {
    message?: string;
    scores: ManualAssessmentScoreDto[];
}

export interface ManualScoresApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveManualScoresApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function manualScoresApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveManualScoresApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(init.headers),
        credentials: "include",
    });

    const text = await response.text();
    let data: unknown = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const body = data as any;
        const message =
            body?.message ||
            body?.error ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const error = new Error(message) as ManualScoresApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * ✅ Counselor case load
 * GET /counselor/case-load
 */
export async function getCounselorCaseLoadApi(): Promise<GetCaseLoadResponseDto> {
    return manualScoresApiFetch<GetCaseLoadResponseDto>("/counselor/case-load", {
        method: "GET",
    });
}

/**
 * ✅ Save manual score
 * POST /counselor/manual-scores
 */
export async function saveManualScoreApi(payload: SaveManualScorePayload): Promise<SaveManualScoreResponseDto> {
    return manualScoresApiFetch<SaveManualScoreResponseDto>("/counselor/manual-scores", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * ✅ List scores per student
 * GET /counselor/manual-scores/student/{studentId}
 */
export async function getStudentManualScoresApi(
    studentId: number | string,
): Promise<GetStudentManualScoresResponseDto> {
    return manualScoresApiFetch<GetStudentManualScoresResponseDto>(
        `/counselor/manual-scores/student/${studentId}`,
        { method: "GET" },
    );
}
