/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";
import type { IntakeRequestDto } from "@/api/intake/route";

/**
 * Response DTO for fetching a student's evaluation records
 * (counseling intake requests).
 *
 * NOTE: The backend currently returns `{ appointments: [...] }`.
 */
export interface GetStudentEvaluationsResponseDto {
    message?: string;
    appointments: IntakeRequestDto[];
}

/**
 * Payload for updating the `details` field of a single evaluation.
 */
export interface UpdateStudentEvaluationDetailsPayload {
    details: string;
}

/**
 * Response DTO when updating a single evaluation.
 *
 * NOTE: The backend currently returns `{ appointment: ... }`.
 */
export interface UpdateStudentEvaluationDetailsResponseDto {
    message?: string;
    appointment: IntakeRequestDto;
}

export interface EvaluationApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveEvaluationApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function evaluationApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveEvaluationApiUrl(path);

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

        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object"
                ? (Object.values(body.errors)[0] as any)?.[0]
                : undefined;

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const error = new Error(message) as EvaluationApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * Fetch all counseling-related evaluations (intake requests) for
 * the currently authenticated student.
 *
 * Backend endpoint:
 *   GET /student/appointments
 */
export async function getStudentEvaluationsApi(): Promise<GetStudentEvaluationsResponseDto> {
    return evaluationApiFetch<GetStudentEvaluationsResponseDto>("/student/appointments", {
        method: "GET",
    });
}

/**
 * Update only the `details` field of a single evaluation.
 *
 * Backend endpoint:
 *   PUT /student/appointments/{id}
 */
export async function updateStudentEvaluationDetailsApi(
    id: number | string,
    payload: UpdateStudentEvaluationDetailsPayload,
): Promise<UpdateStudentEvaluationDetailsResponseDto> {
    return evaluationApiFetch<UpdateStudentEvaluationDetailsResponseDto>(`/student/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}
