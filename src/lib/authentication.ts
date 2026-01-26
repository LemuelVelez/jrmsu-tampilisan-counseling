/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    loginApi,
    registerApi,
    logoutApi,
    meApi,
    AUTH_API_BASE_URL,
    type LoginResponseDto,
    type RegisterResponseDto,
    type AuthenticatedUserDto,
    type RegisterRequestDto,
} from "@/api/auth/route";

export type Role =
    | "admin"
    | "counselor"
    | "student"
    | "guest"
    | "referral_user"
    | "dean"
    | "registrar"
    | "program_chair"
    | string;

export interface AuthUser {
    id: number | string;
    name?: string | null;
    email: string;
    role?: Role | null;
    gender?: string | null;
    avatar_url?: string | null;

    account_type?: "student" | "guest" | "referral_user" | string | null;

    // Allow arbitrary extra properties from the API (student metadata, etc.)
    [key: string]: unknown;
}

export interface AuthSession {
    user: AuthUser | null;
    token: string | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResult extends AuthSession {
    raw: LoginResponseDto;
}

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;

    gender?: string;

    account_type: "student" | "guest" | "referral_user";

    student_id?: string;
    year_level?: string;
    program?: string;
    course?: string;
}

export interface RegisterResult extends AuthSession {
    raw: RegisterResponseDto;
}

export type SessionSubscriber = (session: AuthSession) => void;

export const SESSION_STORAGE_KEY = "ecounseling.session";

const EMPTY_SESSION: AuthSession = {
    user: null,
    token: null,
};

let currentSession: AuthSession = readSessionFromStorage();
const subscribers = new Set<SessionSubscriber>();

function looksLikeFilePath(s: string): boolean {
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    );
}

/**
 * ✅ Normalize avatar_url so UI components using <AvatarImage src="...">
 * load an image properly.
 */
function resolveAbsoluteAvatarUrl(raw: unknown): string | null {
    if (raw == null) return null;

    let s = String(raw).trim();
    if (!s) return null;

    s = s.replace(/\\/g, "/");

    if (/^(data:|blob:)/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("//")) {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
        return `${protocol}${s}`;
    }

    if (!AUTH_API_BASE_URL) {
        if (!s.startsWith("/")) s = `/${s}`;
        return s;
    }

    let origin = AUTH_API_BASE_URL;
    try {
        origin = new URL(AUTH_API_BASE_URL).origin;
    } catch {
        // keep as-is
    }

    let p = s.replace(/^\/+/, "");
    const lower = p.toLowerCase();

    const alreadyStorage = lower.startsWith("storage/") || lower.startsWith("api/storage/");
    if (!alreadyStorage && looksLikeFilePath(p)) {
        p = `storage/${p}`;
    }

    return `${origin}/${p}`;
}

function readSessionFromStorage(): AuthSession {
    if (typeof window === "undefined") {
        return { ...EMPTY_SESSION };
    }

    try {
        const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
            return { ...EMPTY_SESSION };
        }

        const parsed = JSON.parse(raw) as Partial<AuthSession>;
        return {
            user: (parsed.user as AuthUser | null) ?? null,
            token: (parsed.token as string | null) ?? null,
        };
    } catch (error) {
        console.warn("[auth] Failed to read session from localStorage", error);
        return { ...EMPTY_SESSION };
    }
}

function writeSessionToStorage(session: AuthSession | null): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (!session || (!session.user && !session.token)) {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
            return;
        }

        const payload: AuthSession = {
            user: session.user,
            token: session.token ?? null,
        };

        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn("[auth] Failed to persist session to localStorage", error);
    }
}

function notifySubscribers(nextSession: AuthSession): void {
    subscribers.forEach((subscriber) => {
        try {
            subscriber({ ...nextSession });
        } catch (error) {
            console.error("[auth] Session subscriber crashed", error);
        }
    });
}

function normaliseUser(dto: AuthenticatedUserDto): AuthUser {
    const anyDto = dto as any;

    let role: string | null | undefined =
        dto.role ??
        anyDto.role_name ??
        anyDto.type ??
        (Array.isArray(anyDto.roles) && anyDto.roles.length > 0
            ? anyDto.roles[0]?.name ?? anyDto.roles[0]?.slug ?? anyDto.roles[0]
            : undefined);

    if (role != null) {
        role = String(role);
    }

    const name =
        dto.name ??
        anyDto.full_name ??
        (anyDto.first_name && anyDto.last_name ? `${anyDto.first_name} ${anyDto.last_name}` : null);

    const gender = typeof anyDto.gender === "string" && anyDto.gender.length > 0 ? String(anyDto.gender) : null;

    const avatar_url = resolveAbsoluteAvatarUrl(anyDto.avatar_url ?? dto.avatar_url ?? anyDto.avatarUrl ?? null);

    const account_type =
        (anyDto.account_type as string | null | undefined) ??
        (anyDto.accountType as string | null | undefined) ??
        null;

    return {
        ...dto,
        id: dto.id,
        name,
        email: dto.email,
        role: (role as Role | null) ?? null,
        gender,
        avatar_url,
        account_type,
    };
}

function resolveStudentApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }

    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

export function getCurrentSession(): AuthSession {
    return { ...currentSession };
}

export function subscribeToSession(subscriber: SessionSubscriber): () => void {
    subscribers.add(subscriber);
    subscriber({ ...currentSession });

    return () => {
        subscribers.delete(subscriber);
    };
}

export function setSession(session: AuthSession): void {
    currentSession = {
        user: session.user ?? null,
        token: session.token ?? null,
    };

    writeSessionToStorage(currentSession);
    notifySubscribers(currentSession);
}

export function clearSession(): void {
    currentSession = { ...EMPTY_SESSION };
    writeSessionToStorage(null);
    notifySubscribers(currentSession);
}

export async function loginWithEmailPassword(credentials: LoginCredentials): Promise<LoginResult> {
    const response = await loginApi({
        email: credentials.email,
        password: credentials.password,
    });

    const user = normaliseUser(response.user);
    const tokenSource = response.token ?? response.access_token ?? null;
    const token = tokenSource != null ? String(tokenSource) : null;

    const nextSession: AuthSession = { user, token };
    setSession(nextSession);

    return { ...nextSession, raw: response };
}

export async function registerAccount(payload: RegisterPayload): Promise<RegisterResult> {
    const apiPayload: RegisterRequestDto = {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        password_confirmation: payload.password_confirmation,
        gender: payload.gender,
        account_type: payload.account_type,
        student_id: payload.student_id,
        year_level: payload.year_level,
        program: payload.program,
        course: payload.course,
    };

    const response = await registerApi(apiPayload);

    const user = normaliseUser(response.user);
    const tokenSource = response.token ?? response.access_token ?? null;
    const token = tokenSource != null ? String(tokenSource) : null;

    const nextSession: AuthSession = { user, token };
    setSession(nextSession);

    return { ...nextSession, raw: response };
}

export async function logoutFromServer(): Promise<void> {
    try {
        await logoutApi();
    } catch (error) {
        console.warn("[auth] Failed to log out from server", error);
    } finally {
        clearSession();
    }
}

export async function fetchCurrentUserFromServer(): Promise<AuthSession | null> {
    try {
        const dto = await meApi();
        const user = normaliseUser(dto);
        const token = currentSession.token ?? null;

        const nextSession: AuthSession = { user, token };
        setSession(nextSession);

        return { ...nextSession };
    } catch (error) {
        console.warn("[auth] Failed to refresh session from server", error);
        clearSession();
        return null;
    }
}

/**
 * Upload the current user's avatar to the Laravel backend.
 *
 * Endpoint: POST /student/profile/avatar (multipart/form-data)
 */
export interface UploadAvatarResponseDto {
    message?: string;
    avatar_url?: string;
    user: AuthenticatedUserDto;
    [key: string]: unknown;
}

export async function uploadCurrentUserAvatar(
    file: File,
): Promise<{ avatarUrl: string; raw: UploadAvatarResponseDto }> {
    const url = resolveStudentApiUrl("/student/profile/avatar");

    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
            Accept: "application/json",
        },
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
            "An unknown error occurred while uploading your avatar.";

        const error = new Error(message);
        (error as any).status = response.status;
        (error as any).data = body ?? text;
        throw error;
    }

    const body = data as UploadAvatarResponseDto;

    if (!body || !body.user) {
        throw new Error("Invalid avatar upload response from server.");
    }

    const user = normaliseUser(body.user);
    const token = currentSession.token ?? null;

    const nextSession: AuthSession = { user, token };
    setSession(nextSession);

    const resolved = resolveAbsoluteAvatarUrl(body.avatar_url ?? user.avatar_url ?? "") ?? "";

    return {
        avatarUrl: resolved,
        raw: body,
    };
}
