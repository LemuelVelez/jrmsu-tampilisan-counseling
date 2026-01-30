/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Low-level helpers for talking to the Laravel auth API.
 *
 * NOTE:
 * The paths used here (/auth/login, /auth/register, /auth/logout, /auth/me)
 * may need to be adjusted to match your actual Laravel routes.
 */

export type AccountTypeApi = "student" | "guest" | "referral_user" | string

export interface AuthenticatedUserDto {
    id: number | string
    name?: string | null
    email: string
    role?: string | null
    account_type?: AccountTypeApi | null

    gender?: string | null
    avatar_url?: string | null

    // Allow additional metadata from your API (e.g. student fields, etc.)
    [key: string]: unknown
}

export interface LoginRequestDto {
    email: string
    password: string
}

export interface LoginResponseDto {
    user: AuthenticatedUserDto
    token?: string | null
    access_token?: string | null
    [key: string]: unknown
}

export interface RegisterRequestDto {
    // backend expects a name, so include it here
    name: string
    email: string
    password: string
    password_confirmation: string

    gender?: string

    /**
     * ✅ Extended to include "referral_user" (Dean/Registrar/Program Chair),
     * in case your backend later allows direct registration for those roles.
     *
     * If your backend only allows admin to create them, that's fine too.
     */
    account_type: "student" | "guest" | "referral_user"

    student_id?: string
    year_level?: string
    program?: string
    course?: string

    [key: string]: unknown
}

// Use a type alias instead of an empty extending interface to satisfy
// @typescript-eslint/no-empty-object-type
export type RegisterResponseDto = LoginResponseDto

export interface ApiError extends Error {
    status?: number
    data?: unknown
}

/**
 * Forgot-password & reset-password DTOs
 */
export interface ForgotPasswordRequestDto {
    email: string
}

export interface ForgotPasswordResponseDto {
    message: string
    [key: string]: unknown
}

export interface ResetPasswordRequestDto {
    token: string
    email: string
    password: string
    password_confirmation: string
}

export interface ResetPasswordResponseDto {
    message: string
    [key: string]: unknown
}

// Base URL comes from your Vite env (e.g. http://localhost:8000 or http://localhost:8000/api)
const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined

export const AUTH_API_BASE_URL: string | undefined = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.")
    }

    const trimmedPath = path.replace(/^\/+/, "")
    return `${AUTH_API_BASE_URL}/${trimmedPath}`
}

const SESSION_STORAGE_KEY = "ecounseling.session"

function safeTrimString(v: any): string | null {
    if (typeof v !== "string") return null
    const s = v.trim()
    return s ? s : null
}

function stripBearerPrefix(token: string): string {
    const t = token.trim()
    return /^bearer\s+/i.test(t) ? t.replace(/^bearer\s+/i, "").trim() : t
}

function tryParseJson(raw: string): any | null {
    const s = raw.trim()
    if (!s) return null
    try {
        return JSON.parse(s)
    } catch {
        return null
    }
}

function extractTokenFromUnknown(parsed: any): string | null {
    if (!parsed) return null

    // If someone stored the token string directly
    if (typeof parsed === "string") {
        const t = safeTrimString(parsed)
        return t ? stripBearerPrefix(t) : null
    }

    // Common shapes:
    // { user, token } OR { user, access_token } OR { token } OR { access_token }
    const direct =
        safeTrimString(parsed?.token) ||
        safeTrimString(parsed?.access_token) ||
        safeTrimString(parsed?.accessToken) ||
        safeTrimString(parsed?.jwt) ||
        safeTrimString(parsed?.auth_token)

    if (direct) return stripBearerPrefix(direct)

    // Nested shapes (sometimes people store raw login response under "raw")
    const nested =
        safeTrimString(parsed?.raw?.token) ||
        safeTrimString(parsed?.raw?.access_token) ||
        safeTrimString(parsed?.raw?.accessToken) ||
        safeTrimString(parsed?.data?.token) ||
        safeTrimString(parsed?.data?.access_token) ||
        safeTrimString(parsed?.payload?.token) ||
        safeTrimString(parsed?.payload?.access_token)

    if (nested) return stripBearerPrefix(nested)

    return null
}

function readSessionRawFromAnyStorage(): string | null {
    if (typeof window === "undefined") return null

    // Prefer localStorage, but fallback to sessionStorage in case you used that elsewhere
    const fromLocal = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (fromLocal && fromLocal.trim()) return fromLocal

    const fromSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (fromSession && fromSession.trim()) return fromSession

    return null
}

/**
 * ✅ If your backend uses Sanctum cookies, this may not be required.
 * But if your backend returns a Bearer token (token/access_token),
 * we attach it automatically to all requests.
 *
 * ✅ FIX:
 * Token lookup is now robust:
 * - checks localStorage AND sessionStorage
 * - supports token/access_token/accessToken
 * - supports raw nested payloads
 * - supports storing the token as a plain string
 */
export function getStoredAuthToken(): string | null {
    const raw = readSessionRawFromAnyStorage()
    if (!raw) return null

    // If it's JSON, parse it; if not, treat as token string
    const parsed = tryParseJson(raw)
    const token =
        extractTokenFromUnknown(parsed ?? raw) // raw token string fallback
    return token
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {}

    if (headers instanceof Headers) {
        const out: Record<string, string> = {}
        headers.forEach((value, key) => {
            out[key] = value
        })
        return out
    }

    if (Array.isArray(headers)) {
        return headers.reduce((acc, [k, v]) => {
            acc[k] = v
            return acc
        }, {} as Record<string, string>)
    }

    return { ...(headers as Record<string, string>) }
}

/**
 * ✅ Shared JSON headers builder (Accept + Content-Type + optional Authorization)
 */
export function buildJsonHeaders(initHeaders?: HeadersInit): Record<string, string> {
    const base = headersToRecord(initHeaders)

    // Preserve caller-provided Accept if already set
    if (!base.Accept) base.Accept = "application/json"

    // Content-Type for JSON payloads
    if (!base["Content-Type"]) base["Content-Type"] = "application/json"

    // Attach Bearer token if exists and not already set
    const token = getStoredAuthToken()
    if (token && !base.Authorization) {
        base.Authorization = `Bearer ${token}`
    }

    return base
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveApiUrl(path)

    const response = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(init.headers),
        // Allow Laravel Sanctum / cookie-based auth
        credentials: "include",
    })

    const text = await response.text()
    let data: unknown

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = text
        }
    }

    if (!response.ok) {
        const body = data as any

        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object"
                ? (Object.values(body.errors)[0] as any)?.[0]
                : undefined

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            response.statusText ||
            "An unknown error occurred while communicating with the server."

        const error = new Error(message) as ApiError
        error.status = response.status
        error.data = body ?? text
        throw error
    }

    return data as T
}

export async function loginApi(payload: LoginRequestDto): Promise<LoginResponseDto> {
    return apiFetch<LoginResponseDto>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

export async function registerApi(payload: RegisterRequestDto): Promise<RegisterResponseDto> {
    return apiFetch<RegisterResponseDto>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

export async function logoutApi(): Promise<void> {
    await apiFetch<unknown>("/auth/logout", {
        method: "POST",
    })
}

export async function meApi(): Promise<AuthenticatedUserDto> {
    const payload = await apiFetch<{ user: AuthenticatedUserDto }>("/auth/me", {
        method: "GET",
    })
    return payload.user
}

/**
 * Request a password reset link.
 *
 * Endpoint: POST /auth/password/forgot
 */
export async function forgotPasswordApi(payload: ForgotPasswordRequestDto): Promise<ForgotPasswordResponseDto> {
    return apiFetch<ForgotPasswordResponseDto>("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

/**
 * Submit a new password using a reset token.
 *
 * Endpoint: POST /auth/password/reset
 */
export async function resetPasswordApi(payload: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
    return apiFetch<ResetPasswordResponseDto>("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify(payload),
    })
}
