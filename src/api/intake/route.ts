/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

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

    // Student preference
    preferred_date: string | null; // ISO date string (YYYY-MM-DD)
    preferred_time: string | null; // e.g. "14:30" or "8:00 AM"

    // Counselor final schedule ✅
    scheduled_date?: string | null; // ISO date string (YYYY-MM-DD)
    scheduled_time?: string | null; // e.g. "8:00 AM"

    details: string;
    status: string;

    /**
     * ✅ Optional convenience fields for counselor table view
     * (backend may include these)
     */
    student_name?: string | null;
    student_email?: string | null;
    student_id?: string | null;

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
    consent: boolean;

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

/**
 * Response DTO for fetching a student's assessment history.
 */
export interface GetStudentAssessmentsResponseDto {
    message?: string;
    assessments: IntakeAssessmentDto[];
}

/** -----------------------------
 * Counselor: Pagination + Student Profile + History
 * ------------------------------*/

export interface PaginationMetaDto {
    current_page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
}

export interface PaginatedResponseDto<T> {
    message?: string;
    data: T[];
    meta?: PaginationMetaDto;

    // Backend may return these names (Laravel pagination)
    current_page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
}

export interface GetCounselorAppointmentsQuery {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
}

export type GetCounselorAppointmentsResponseDto = PaginatedResponseDto<IntakeRequestDto>;

export interface CounselorUpdateAppointmentPayload {
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    status?: string | null;
    details?: string;
}

export interface CounselorUpdateAppointmentResponseDto {
    message?: string;
    appointment: IntakeRequestDto;
}

/**
 * Counselor-only student profile DTO (minimal safe data).
 */
export interface CounselorStudentProfileDto {
    id: number | string;
    name?: string | null;
    email?: string | null;
    gender?: string | null;

    student_id?: string | null;
    year_level?: string | null;
    program?: string | null;
    course?: string | null;

    [key: string]: unknown;
}

export interface GetCounselorStudentProfileResponseDto {
    message?: string;
    student: CounselorStudentProfileDto;
}

/**
 * Student counseling history for counselor view.
 */
export interface StudentCounselingHistoryDto {
    total_appointments: number;
    appointments: IntakeRequestDto[];
}

export interface GetCounselorStudentHistoryResponseDto {
    message?: string;
    history: StudentCounselingHistoryDto;
}

/** -----------------------------
 * Counselor: Assessments list (for reports)
 * ------------------------------*/

export interface CounselorAssessmentUserDto {
    id: number | string;
    name?: string | null;
    email?: string | null;
    [key: string]: unknown;
}

export interface CounselorAssessmentRecordDto extends IntakeAssessmentDto {
    user?: CounselorAssessmentUserDto;
}

export interface GetCounselorAssessmentsResponseDto {
    message?: string;
    assessments: CounselorAssessmentRecordDto[];
}

export interface IntakeApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveIntakeApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

function buildQueryString(params?: Record<string, any>): string {
    if (!params) return "";
    const sp = new URLSearchParams();

    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
    });

    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

async function intakeApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveIntakeApiUrl(path);

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

        const error = new Error(message) as IntakeApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/** -----------------------------
 * Student Endpoints
 * ------------------------------*/

export async function createIntakeRequestApi(
    payload: CreateIntakeRequestPayload,
): Promise<CreateIntakeRequestResponseDto> {
    return intakeApiFetch<CreateIntakeRequestResponseDto>("/student/intake", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function createIntakeAssessmentApi(
    payload: CreateIntakeAssessmentPayload,
): Promise<CreateIntakeAssessmentResponseDto> {
    return intakeApiFetch<CreateIntakeAssessmentResponseDto>("/student/intake/assessment", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getStudentAssessmentsApi(): Promise<GetStudentAssessmentsResponseDto> {
    return intakeApiFetch<GetStudentAssessmentsResponseDto>("/student/intake/assessments", {
        method: "GET",
    });
}

/** -----------------------------
 * Counselor Endpoints (NEW)
 * ------------------------------*/

/**
 * ✅ Counselor Appointments List with pagination support
 * Backend example:
 * GET /counselor/appointments?page=1&per_page=10
 */
export async function getCounselorAppointmentsApi(
    query?: GetCounselorAppointmentsQuery,
): Promise<GetCounselorAppointmentsResponseDto> {
    const qs = buildQueryString({
        page: query?.page,
        per_page: query?.per_page ?? 10,
        status: query?.status,
        search: query?.search,
    });

    return intakeApiFetch<GetCounselorAppointmentsResponseDto>(`/counselor/appointments${qs}`, {
        method: "GET",
    });
}

/**
 * ✅ Counselor updates appointment schedule/status/details
 * PUT /counselor/appointments/{id}
 */
export async function updateCounselorAppointmentApi(
    id: number | string,
    payload: CounselorUpdateAppointmentPayload,
): Promise<CounselorUpdateAppointmentResponseDto> {
    return intakeApiFetch<CounselorUpdateAppointmentResponseDto>(`/counselor/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

/**
 * ✅ Counselor student profile
 * GET /counselor/students/{studentId}
 */
export async function getCounselorStudentProfileApi(
    studentId: number | string,
): Promise<GetCounselorStudentProfileResponseDto> {
    return intakeApiFetch<GetCounselorStudentProfileResponseDto>(`/counselor/students/${studentId}`, {
        method: "GET",
    });
}

/**
 * ✅ Counselor student history
 * GET /counselor/students/{studentId}/history
 */
export async function getCounselorStudentHistoryApi(
    studentId: number | string,
): Promise<GetCounselorStudentHistoryResponseDto> {
    return intakeApiFetch<GetCounselorStudentHistoryResponseDto>(
        `/counselor/students/${studentId}/history`,
        { method: "GET" },
    );
}

/**
 * ✅ Counselor assessments list (for Assessment Reports page)
 * Tries a few likely paths to be robust with route naming.
 *
 * Expected backend response:
 * { assessments: [...] }
 */
export async function getCounselorAssessmentsApi(): Promise<GetCounselorAssessmentsResponseDto> {
    const tryPaths = [
        "/counselor/assessments",
        "/counselor/intake/assessments",
        "/counselor/intake-assessments",
    ];

    let lastErr: any = null;

    for (const path of tryPaths) {
        try {
            const json = await intakeApiFetch<any>(path, { method: "GET" });
            const assessments = (json?.assessments ?? json?.data ?? json) as CounselorAssessmentRecordDto[];
            return {
                message: json?.message,
                assessments: Array.isArray(assessments) ? assessments : [],
            };
        } catch (e: any) {
            lastErr = e;
            const status = Number(e?.status);
            if (status === 404 || status === 405) continue;
            throw e;
        }
    }

    throw lastErr ?? new Error("Failed to fetch counselor assessments.");
}
