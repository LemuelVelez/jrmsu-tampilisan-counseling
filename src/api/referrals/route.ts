/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route";

export type ReferralStatusApi = "pending" | "handled" | "closed" | string;
export type ReferralUrgencyApi = "low" | "medium" | "high" | string;

export interface UserMiniDto {
    id: number | string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    [key: string]: unknown;
}

export interface ReferralDto {
    id: number | string;

    status: ReferralStatusApi;

    concern_type?: string | null;
    urgency?: ReferralUrgencyApi | null;
    details?: string | null;

    remarks?: string | null;
    handled_at?: string | null;
    closed_at?: string | null;

    created_at?: string | null;
    updated_at?: string | null;

    student?: UserMiniDto | null;
    requestedBy?: UserMiniDto | null;
    requested_by?: UserMiniDto | null;
    counselor?: UserMiniDto | null;

    // flat fallbacks (if backend returns flat)
    student_name?: string | null;
    student_email?: string | null;
    requested_by_name?: string | null;
    requested_by_role?: string | null;
    requested_by_email?: string | null;

    [key: string]: unknown;
}

/**
 * Referral-user creates a referral
 * POST /referral-user/referrals
 */
export interface CreateReferralPayload {
    student_id: number | string;
    concern_type: string;
    urgency: "low" | "medium" | "high";
    details: string;
}

export interface CreateReferralResponseDto {
    message?: string;
    referral: ReferralDto;
}

/**
 * Counselor lists referrals
 * GET /counselor/referrals
 */
export interface GetCounselorReferralsResponseDto {
    message?: string;
    referrals: ReferralDto[];
    meta?: {
        current_page?: number;
        per_page?: number;
        total?: number;
        last_page?: number;
        [key: string]: unknown;
    };
}

export interface GetReferralUserReferralsResponseDto {
    message?: string;
    referrals: ReferralDto[];
    meta?: {
        current_page?: number;
        per_page?: number;
        total?: number;
        last_page?: number;
        [key: string]: unknown;
    };
}

/**
 * GET /counselor/referrals/{id} OR /referral-user/referrals/{id}
 */
export interface GetReferralByIdResponseDto {
    referral: ReferralDto;
}

export interface PatchReferralPayload {
    status?: ReferralStatusApi;
    remarks?: string | null;
    counselor_id?: number | string | null;
}

export interface PatchReferralResponseDto {
    message?: string;
    referral: ReferralDto;
}

export interface ReferralsApiError extends Error {
    status?: number;
    data?: unknown;
}

function trimSlash(s: string) {
    return s.replace(/\/+$/, "");
}

function resolveReferralsApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${trimSlash(AUTH_API_BASE_URL)}/${trimmedPath}`;
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
        const rawStr = typeof data === "string" ? data : "";
        const message =
            body?.message ||
            body?.error ||
            (rawStr ? rawStr.slice(0, 220) : "") ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const error = new Error(message) as ReferralsApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

export async function createReferralApi(payload: CreateReferralPayload): Promise<CreateReferralResponseDto> {
    return referralsApiFetch<CreateReferralResponseDto>("/referral-user/referrals", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getCounselorReferralsApi(params?: {
    per_page?: number;
    status?: string;
}): Promise<GetCounselorReferralsResponseDto> {
    const qs = new URLSearchParams();
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.status && params.status !== "all") qs.set("status", String(params.status));

    const path = qs.toString() ? `/counselor/referrals?${qs.toString()}` : "/counselor/referrals";

    return referralsApiFetch<GetCounselorReferralsResponseDto>(path, {
        method: "GET",
    });
}

export async function getReferralUserReferralsApi(params?: {
    per_page?: number;
}): Promise<GetReferralUserReferralsResponseDto> {
    const qs = new URLSearchParams();
    if (params?.per_page) qs.set("per_page", String(params.per_page));

    const path = qs.toString() ? `/referral-user/referrals?${qs.toString()}` : "/referral-user/referrals";

    return referralsApiFetch<GetReferralUserReferralsResponseDto>(path, {
        method: "GET",
    });
}

export async function getCounselorReferralByIdApi(id: number | string): Promise<GetReferralByIdResponseDto> {
    return referralsApiFetch<GetReferralByIdResponseDto>(`/counselor/referrals/${encodeURIComponent(String(id))}`, {
        method: "GET",
    });
}

export async function patchCounselorReferralApi(
    id: number | string,
    payload: PatchReferralPayload,
): Promise<PatchReferralResponseDto> {
    return referralsApiFetch<PatchReferralResponseDto>(`/counselor/referrals/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}
