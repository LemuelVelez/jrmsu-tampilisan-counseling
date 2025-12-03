/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL } from "@/api/auth/route";
import type { IntakeRequestDto } from "@/api/intake/route";

export interface GetStudentAppointmentsResponseDto {
    message?: string;
    appointments: IntakeRequestDto[];
}

export interface UpdateStudentAppointmentDetailsPayload {
    details: string;
}

export interface UpdateStudentAppointmentDetailsResponseDto {
    message?: string;
    appointment: IntakeRequestDto;
}

export interface AppointmentsApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveAppointmentsApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function appointmentsApiFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const url = resolveAppointmentsApiUrl(path);

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

        const error = new Error(message) as AppointmentsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * Fetch all counseling-related appointments (intake requests) for
 * the currently authenticated student.
 *
 * GET /student/appointments
 */
export async function getStudentAppointmentsApi(): Promise<GetStudentAppointmentsResponseDto> {
    return appointmentsApiFetch<GetStudentAppointmentsResponseDto>(
        "/student/appointments",
        {
            method: "GET",
        },
    );
}

/**
 * Update only the `details` field of a single appointment.
 *
 * PUT /student/appointments/{id}
 */
export async function updateStudentAppointmentDetailsApi(
    id: number | string,
    payload: UpdateStudentAppointmentDetailsPayload,
): Promise<UpdateStudentAppointmentDetailsResponseDto> {
    return appointmentsApiFetch<UpdateStudentAppointmentDetailsResponseDto>(
        `/student/appointments/${id}`,
        {
            method: "PUT",
            body: JSON.stringify(payload),
        },
    );
}
