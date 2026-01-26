/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

export type ReferralStatusApi = "pending" | "handled" | "closed" | string;

export interface ReferralDto {
    id: number | string;

    student_id: number | string;
    student_name?: string | null;
    student_email?: string | null;

    concern: string;
    details?: string | null;

    status: ReferralStatusApi;

    /**
     * ✅ Requested By (Dean/Registrar/Program Chair)
     */
    requested_by_id?: number | string | null;
    requested_by_name?: string | null;
    requested_by_role?: string | null;

    created_at?: string;
    updated_at?: string;

    [key: string]: unknown;
}

/**
 * Referral-user creates a referral
 */
export interface CreateReferralPayload {
    student_id: number | string;
    concern: string;
    details?: string;
}

export interface CreateReferralResponseDto {
    message?: string;
    referral: ReferralDto;
}

/**
 * Counselor lists referrals
 */
export interface GetCounselorReferralsResponseDto {
    message?: string;
    referrals: ReferralDto[];
}

export interface GetReferralUserReferralsResponseDto {
    message?: string;
    referrals: ReferralDto[];
}

export interface UpdateReferralStatusPayload {
    status: ReferralStatusApi;
}

export interface UpdateReferralStatusResponseDto {
    message?: string;
    referral: ReferralDto;
}

export interface ReferralsApiError extends Error {
    status?: number;
    data?: unknown;
}

function resolveReferralsApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function referralsApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveReferralsApiUrl(path);

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

        const error = new Error(message) as ReferralsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

/**
 * ✅ Referral user submit referral
 * POST /referral-user/referrals
 */
export async function createReferralApi(payload: CreateReferralPayload): Promise<CreateReferralResponseDto> {
    return referralsApiFetch<CreateReferralResponseDto>("/referral-user/referrals", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * ✅ Counselor fetch referrals
 * GET /counselor/referrals
 */
export async function getCounselorReferralsApi(): Promise<GetCounselorReferralsResponseDto> {
    return referralsApiFetch<GetCounselorReferralsResponseDto>("/counselor/referrals", {
        method: "GET",
    });
}

/**
 * ✅ Referral user referral history
 * GET /referral-user/referrals
 */
export async function getReferralUserReferralsApi(): Promise<GetReferralUserReferralsResponseDto> {
    return referralsApiFetch<GetReferralUserReferralsResponseDto>("/referral-user/referrals", {
        method: "GET",
    });
}

/**
 * ✅ Counselor update referral status
 * PUT /counselor/referrals/{id}/status
 */
export async function updateReferralStatusApi(
    id: number | string,
    payload: UpdateReferralStatusPayload,
): Promise<UpdateReferralStatusResponseDto> {
    return referralsApiFetch<UpdateReferralStatusResponseDto>(`/counselor/referrals/${id}/status`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}
