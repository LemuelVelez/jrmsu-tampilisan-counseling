/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL } from "@/api/auth/route";

export type MentalFrequencyApi =
    | "not_at_all"
    | "several_days"
    | "more_than_half"
    | "nearly_every_day";

/**
 * DTO for the main intake request (concern + preferred schedule).
 * Backed by the `intake_requests` table.
 */
export interface IntakeRequestDto {
    id: number;
    user_id: number | string;

    // Core scheduling + status
    concern_type: string | null;
    urgency: "low" | "medium" | "high" | string | null;
    preferred_date: string | null; // ISO date string (YYYY-MM-DD)
    preferred_time: string | null; // e.g. "14:30" or "8:00 AM"
    details: string;
    status: string;

    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

/**
 * DTO for the assessment (Steps 1–3 – consent + demographics + MH status).
 * Backed by the `intake_assessments` table.
 */
export interface IntakeAssessmentDto {
    id: number;
    user_id: number | string;

    // Consent & demographic snapshot
    consent: boolean;
    student_name?: string | null;
    age?: number | null;
    gender?: string | null;
    occupation?: string | null;
    living_situation?: string | null;
    living_situation_other?: string | null;

    // Mental health questionnaire fields
    mh_little_interest?: MentalFrequencyApi | null;
    mh_feeling_down?: MentalFrequencyApi | null;
    mh_sleep?: MentalFrequencyApi | null;
    mh_energy?: MentalFrequencyApi | null;
    mh_appetite?: MentalFrequencyApi | null;
    mh_self_esteem?: MentalFrequencyApi | null;
    mh_concentration?: MentalFrequencyApi | null;
    mh_motor?: MentalFrequencyApi | null;
    mh_self_harm?: MentalFrequencyApi | null;

    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

/**
 * Payload for creating a new intake request (Step 4 only).
 */
export interface CreateIntakeRequestPayload {
    // Core required fields
    concern_type: string;
    urgency: "low" | "medium" | "high";
    preferred_date: string;
    preferred_time: string;
    details: string;
}

/**
 * Payload for creating a new assessment record (Steps 1–3).
 */
export interface CreateIntakeAssessmentPayload {
    // Consent (required on backend)
    consent: boolean;

    // Optional demographic + questionnaire fields
    student_name?: string;
    age?: number;
    gender?: string;
    occupation?: string;
    living_situation?: string;
    living_situation_other?: string;

    mh_little_interest?: MentalFrequencyApi;
    mh_feeling_down?: MentalFrequencyApi;
    mh_sleep?: MentalFrequencyApi;
    mh_energy?: MentalFrequencyApi;
    mh_appetite?: MentalFrequencyApi;
    mh_self_esteem?: MentalFrequencyApi;
    mh_concentration?: MentalFrequencyApi;
    mh_motor?: MentalFrequencyApi;
    mh_self_harm?: MentalFrequencyApi;
}

export interface CreateIntakeRequestResponseDto {
    message?: string;
    intake: IntakeRequestDto;
}

export interface CreateIntakeAssessmentResponseDto {
    message?: string;
    assessment: IntakeAssessmentDto;
}

export interface IntakeApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveIntakeApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function intakeApiFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const url = resolveIntakeApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
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

        const error = new Error(message) as IntakeApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * Create a new counseling intake request (Step 4).
 *
 * POST /student/intake
 */
export async function createIntakeRequestApi(
    payload: CreateIntakeRequestPayload,
): Promise<CreateIntakeRequestResponseDto> {
    return intakeApiFetch<CreateIntakeRequestResponseDto>("/student/intake", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Create a new assessment record (Steps 1–3).
 *
 * POST /student/intake/assessment
 */
export async function createIntakeAssessmentApi(
    payload: CreateIntakeAssessmentPayload,
): Promise<CreateIntakeAssessmentResponseDto> {
    return intakeApiFetch<CreateIntakeAssessmentResponseDto>(
        "/student/intake/assessment",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
}
