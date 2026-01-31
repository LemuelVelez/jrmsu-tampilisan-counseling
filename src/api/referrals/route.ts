/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route"
import { getCurrentSession } from "@/lib/authentication"

export type ReferralStatusApi = "pending" | "handled" | "closed" | string
export type ReferralUrgencyApi = "low" | "medium" | "high" | string

export interface UserMiniDto {
    id: number | string
    name?: string | null
    email?: string | null
    role?: string | null
    [key: string]: unknown
}

export interface ReferralDto {
    id: number | string

    status: ReferralStatusApi

    concern_type?: string | null
    urgency?: ReferralUrgencyApi | null
    details?: string | null

    remarks?: string | null
    handled_at?: string | null
    closed_at?: string | null

    created_at?: string | null
    updated_at?: string | null

    student?: UserMiniDto | null
    requestedBy?: UserMiniDto | null
    requested_by?: UserMiniDto | null
    counselor?: UserMiniDto | null

    // flat fallbacks (if backend returns flat)
    student_name?: string | null
    student_email?: string | null
    requested_by_name?: string | null
    requested_by_role?: string | null
    requested_by_email?: string | null

    [key: string]: unknown
}

export interface CreateReferralPayload {
    /**
     * ✅ MUST be string (backend validator requires string)
     * - manual: users.student_id
     * - search: users.student_id (preferred) OR users.id fallback as string
     */
    student_id: string
    concern_type: string
    urgency: "low" | "medium" | "high"
    details: string
}

export interface CreateReferralResponseDto {
    message?: string
    referral: ReferralDto
}

export interface GetCounselorReferralsResponseDto {
    message?: string
    referrals: ReferralDto[]
    meta?: {
        current_page?: number
        per_page?: number
        total?: number
        last_page?: number
        [key: string]: unknown
    }
}

export interface GetReferralUserReferralsResponseDto {
    message?: string
    referrals: ReferralDto[]
    meta?: {
        current_page?: number
        per_page?: number
        total?: number
        last_page?: number
        [key: string]: unknown
    }
}

export interface GetReferralByIdResponseDto {
    referral: ReferralDto
}

export interface PatchReferralPayload {
    status?: ReferralStatusApi
    remarks?: string | null
    counselor_id?: number | string | null
}

export interface PatchReferralResponseDto {
    message?: string
    referral: ReferralDto
}

export interface ReferralsApiError extends Error {
    status?: number
    data?: unknown
}

function trimSlash(s: string) {
    return s.replace(/\/+$/, "")
}

function resolveBaseUrl(): string {
    const env = (import.meta as any)?.env ?? {}

    // Prefer the existing AUTH_API_BASE_URL (because your app already uses it elsewhere),
    // but also support the env names directly in case auth/route.ts uses a different one.
    const base =
        (typeof AUTH_API_BASE_URL === "string" && AUTH_API_BASE_URL) ||
        env?.VITE_API_LARAVEL_BASE_URL ||
        env?.VITE_LARAVEL_API_BASE_URL ||
        env?.VITE_API_BASE_URL ||
        ""

    const raw = String(base || "").trim()
    if (!raw) return ""

    return trimSlash(raw)
}

function resolveReferralsApiUrl(path: string): string {
    const base = resolveBaseUrl()

    if (!base) {
        throw new Error(
            [
                "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your frontend .env file.",
                "Make sure:",
                "- .env is at the Vite project root (same level as package.json)",
                "- variable starts with VITE_",
                "- restart `npm run dev` after editing env",
            ].join("\n"),
        )
    }

    const trimmedPath = path.replace(/^\/+/, "")
    return `${base}/${trimmedPath}`
}

function getSessionToken(): string | null {
    try {
        const session = getCurrentSession() as any
        return session?.token ?? session?.access_token ?? null
    } catch {
        return null
    }
}

async function referralsApiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
    const url = resolveReferralsApiUrl(path)

    const finalToken = token ?? getSessionToken()

    const headers = new Headers(buildJsonHeaders(init.headers))
    if (finalToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${finalToken}`)
    }

    const response = await fetch(url, {
        ...init,
        headers,
        credentials: "include",
    })

    const text = await response.text()
    let data: unknown = null

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = text
        }
    }

    if (!response.ok) {
        const body = data as any
        const rawStr = typeof data === "string" ? data : ""
        const message =
            body?.message ||
            body?.error ||
            (rawStr ? rawStr.slice(0, 220) : "") ||
            response.statusText ||
            "An unknown error occurred while communicating with the server."

        const error = new Error(message) as ReferralsApiError
        error.status = response.status
        error.data = body ?? text
        throw error
    }

    return data as T
}

export async function createReferralApi(
    payload: CreateReferralPayload,
    token?: string | null,
): Promise<CreateReferralResponseDto> {
    return referralsApiFetch<CreateReferralResponseDto>(
        "/referral-user/referrals",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    )
}

export async function getCounselorReferralsApi(
    params?: { per_page?: number; status?: string },
    token?: string | null,
): Promise<GetCounselorReferralsResponseDto> {
    const qs = new URLSearchParams()
    if (params?.per_page) qs.set("per_page", String(params.per_page))
    if (params?.status && params.status !== "all") qs.set("status", String(params.status))

    const path = qs.toString() ? `/counselor/referrals?${qs.toString()}` : "/counselor/referrals"

    return referralsApiFetch<GetCounselorReferralsResponseDto>(
        path,
        {
            method: "GET",
        },
        token,
    )
}

export async function getReferralUserReferralsApi(
    params?: { per_page?: number },
    token?: string | null,
): Promise<GetReferralUserReferralsResponseDto> {
    const qs = new URLSearchParams()
    if (params?.per_page) qs.set("per_page", String(params.per_page))

    const path = qs.toString() ? `/referral-user/referrals?${qs.toString()}` : "/referral-user/referrals"

    return referralsApiFetch<GetReferralUserReferralsResponseDto>(
        path,
        {
            method: "GET",
        },
        token,
    )
}

export async function getCounselorReferralByIdApi(
    id: number | string,
    token?: string | null,
): Promise<GetReferralByIdResponseDto> {
    return referralsApiFetch<GetReferralByIdResponseDto>(
        `/counselor/referrals/${encodeURIComponent(String(id))}`,
        {
            method: "GET",
        },
        token,
    )
}

export async function patchCounselorReferralApi(
    id: number | string,
    payload: PatchReferralPayload,
    token?: string | null,
): Promise<PatchReferralResponseDto> {
    return referralsApiFetch<PatchReferralResponseDto>(
        `/counselor/referrals/${encodeURIComponent(String(id))}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload),
        },
        token,
    )
}
