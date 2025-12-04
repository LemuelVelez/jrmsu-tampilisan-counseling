/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Low-level helpers for talking to the Laravel auth API.
 *
 * NOTE:
 * The paths used here (/auth/login, /auth/register, /auth/logout, /auth/me)
 * may need to be adjusted to match your actual Laravel routes.
 */

export interface AuthenticatedUserDto {
    id: number | string;
    name?: string | null;
    email: string;
    role?: string | null;
    gender?: string | null;
    avatar_url?: string | null;
    // Allow additional metadata from your API (e.g. student fields, etc.)
    [key: string]: unknown;
}

export interface LoginRequestDto {
    email: string;
    password: string;
}

export interface LoginResponseDto {
    user: AuthenticatedUserDto;
    token?: string | null;
    access_token?: string | null;
    [key: string]: unknown;
}

export interface RegisterRequestDto {
    // 👈 NEW: backend expects a name, so include it here
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    gender?: string;
    account_type: "student" | "guest";
    student_id?: string;
    year_level?: string;
    program?: string;
    course?: string;
    [key: string]: unknown;
}

// Use a type alias instead of an empty extending interface to satisfy
// @typescript-eslint/no-empty-object-type
export type RegisterResponseDto = LoginResponseDto;

export interface ApiError extends Error {
    status?: number;
    data?: unknown;
}

// Base URL comes from your Vite env (e.g. http://localhost:8000/api)
const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as
    | string
    | undefined;

export const AUTH_API_BASE_URL: string | undefined = RAW_BASE_URL
    ? RAW_BASE_URL.replace(/\/+$/, "")
    : undefined;

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        // Allow Laravel Sanctum / cookie-based auth
        credentials: "include",
    });

    const text = await response.text();
    let data: unknown;

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

        const error = new Error(message) as ApiError;
        error.status = response.status;
        error.data = body ?? text;
        throw error;
    }

    return data as T;
}

export async function loginApi(
    payload: LoginRequestDto,
): Promise<LoginResponseDto> {
    // Adjust the path here if your Laravel route is different (e.g. "/login")
    return apiFetch<LoginResponseDto>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function registerApi(
    payload: RegisterRequestDto,
): Promise<RegisterResponseDto> {
    // Adjust the path here if your Laravel route is different (e.g. "/register")
    return apiFetch<RegisterResponseDto>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function logoutApi(): Promise<void> {
    // Adjust the path here if your Laravel route is different (e.g. "/logout")
    await apiFetch<unknown>("/auth/logout", {
        method: "POST",
    });
}

export async function meApi(): Promise<AuthenticatedUserDto> {
    // Optional helper for refreshing the currently authenticated user.
    const payload = await apiFetch<{ user: AuthenticatedUserDto }>("/auth/me", {
        method: "GET",
    });
    return payload.user;
}
