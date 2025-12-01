import type { IntakeRequestDto } from "@/api/intake/route";
import {
    getStudentAppointmentsApi,
    type GetStudentAppointmentsResponseDto,
    updateStudentAppointmentDetailsApi,
    type UpdateStudentAppointmentDetailsPayload,
} from "@/api/appointments/route";

export type StudentAppointment = IntakeRequestDto;

export type UpdateAppointmentDetailsPayload =
    UpdateStudentAppointmentDetailsPayload;

/**
 * High-level helper used by the React appointments page.
 * Wraps the lower-level API function.
 */
export async function fetchStudentAppointments(): Promise<GetStudentAppointmentsResponseDto> {
    return getStudentAppointmentsApi();
}

/**
 * Update only the `details` field of a single appointment.
 */
export async function updateAppointmentDetails(
    id: number | string,
    payload: UpdateAppointmentDetailsPayload,
): Promise<StudentAppointment> {
    const response = await updateStudentAppointmentDetailsApi(id, payload);
    return response.appointment;
}
