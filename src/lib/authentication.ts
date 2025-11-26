/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    loginApi,
    registerApi,
    logoutApi,
    meApi,
    type LoginResponseDto,
    type RegisterResponseDto,
    type AuthenticatedUserDto,
    type RegisterRequestDto,
} from "@/api/auth/route";

export type Role = "admin" | "counselor" | "student" | string;

export interface AuthUser {
    id: number | string;
    name?: string | null;
    email: string;
    role?: Role | null;
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
    email: string;
    password: string;
    password_confirmation: string;
    gender?: string;
    account_type: "student" | "guest";
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
        (anyDto.first_name && anyDto.last_name
            ? `${anyDto.first_name} ${anyDto.last_name}`
            : null);

    return {
        ...dto,
        id: dto.id,
        name,
        email: dto.email,
        role: (role as Role | null) ?? null,
    };
}

/**
 * Returns the last known session (from memory / localStorage).
 * This does NOT validate that the session is still valid on the server.
 */
export function getCurrentSession(): AuthSession {
    return { ...currentSession };
}

/**
 * Subscribe to in-memory session updates.
 * Returns an unsubscribe function.
 */
export function subscribeToSession(
    subscriber: SessionSubscriber,
): () => void {
    subscribers.add(subscriber);
    // Immediately call with the current value so subscribers don't need a separate get.
    subscriber({ ...currentSession });

    return () => {
        subscribers.delete(subscriber);
    };
}

/**
 * Replace the current session and persist it to localStorage.
 */
export function setSession(session: AuthSession): void {
    currentSession = {
        user: session.user ?? null,
        token: session.token ?? null,
    };

    writeSessionToStorage(currentSession);
    notifySubscribers(currentSession);
}

/**
 * Clears the current session and removes it from localStorage.
 */
export function clearSession(): void {
    currentSession = { ...EMPTY_SESSION };
    writeSessionToStorage(null);
    notifySubscribers(currentSession);
}

/**
 * Sign in with email + password against the Laravel API.
 * On success, updates the global session store and returns the new session.
 */
export async function loginWithEmailPassword(
    credentials: LoginCredentials,
): Promise<LoginResult> {
    const response = await loginApi({
        email: credentials.email,
        password: credentials.password,
    });

    const user = normaliseUser(response.user);
    const tokenSource = response.token ?? response.access_token ?? null;
    const token = tokenSource != null ? String(tokenSource) : null;

    const nextSession: AuthSession = {
        user,
        token,
    };

    setSession(nextSession);

    return {
        ...nextSession,
        raw: response,
    };
}

/**
 * Register a new account via the Laravel API.
 * Many backends also log the user in immediately and return a token/user,
 * so we mirror the login behaviour here.
 */
export async function registerAccount(
    payload: RegisterPayload,
): Promise<RegisterResult> {
    const apiPayload: RegisterRequestDto = {
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

    const nextSession: AuthSession = {
        user,
        token,
    };

    setSession(nextSession);

    return {
        ...nextSession,
        raw: response,
    };
}

/**
 * Log out both locally and on the server.
 */
export async function logoutFromServer(): Promise<void> {
    try {
        await logoutApi();
    } catch (error) {
        // Even if the server call fails (e.g. network is offline), we still
        // clear the local session so the user is effectively logged out.
        console.warn("[auth] Failed to log out from server", error);
    } finally {
        clearSession();
    }
}

/**
 * Optional helper to re-fetch the authenticated user from the backend and
 * update the in-memory session. Useful when loading the app for the first time.
 *
 * NOTE: This assumes that your Laravel backend exposes an /auth/me (or similar)
 * route, which is where meApi points to. Adjust that route in src/api/auth/route.ts
 * if needed.
 */
export async function fetchCurrentUserFromServer(): Promise<AuthSession | null> {
    try {
        const dto = await meApi();
        const user = normaliseUser(dto);
        const token = currentSession.token ?? null;

        const nextSession: AuthSession = {
            user,
            token,
        };

        setSession(nextSession);
        return { ...nextSession };
    } catch (error) {
        console.warn("[auth] Failed to refresh session from server", error);
        clearSession();
        return null;
    }
}
