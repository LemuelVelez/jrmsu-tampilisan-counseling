/* eslint-disable @typescript-eslint/no-explicit-any */
import { AUTH_API_BASE_URL, buildJsonHeaders } from "@/api/auth/route"

export type ManualScoreRatingApi =
    | "Poor"
    | "Fair"
    | "Good"
    | "Very Good"
    | "poor"
    | "fair"
    | "good"
    | "very_good"
    | string

export interface ManualAssessmentScoreDto {
    id: number | string

    student_id: number | string
    counselor_id: number | string

    score: number
    rating: ManualScoreRatingApi

    // Backend uses assessed_date; older clients may use date
    assessed_date?: string // YYYY-MM-DD
    date?: string // YYYY-MM-DD (compat)

    remarks?: string | null

    created_at?: string
    updated_at?: string

    // Backend may include relations:
    student?: any
    counselor?: any

    [key: string]: unknown
}

export interface CaseLoadStudentDto {
    id: number | string
    name?: string | null
    email?: string | null

    student_id?: string | null
    program?: string | null
    year_level?: string | null

    avatar_url?: string | null
    course?: string | null
    gender?: string | null

    [key: string]: unknown
}

export interface GetCaseLoadResponseDto {
    message?: string
    students: CaseLoadStudentDto[]
}

export interface SaveManualScorePayload {
    student_id: number | string
    score: number

    // Laravel controller validates assessed_date
    assessed_date: string // YYYY-MM-DD

    // Optional compatibility field (some older payloads used date)
    date?: string // YYYY-MM-DD

    remarks?: string
}

export interface SaveManualScoreResponseDto {
    message?: string
    // backend returns scoreRecord; some clients return record
    record: ManualAssessmentScoreDto
}

export interface GetStudentManualScoresResponseDto {
    message?: string
    scores: ManualAssessmentScoreDto[]
}

/**
 * ✅ Directory list response (varies per backend implementation)
 */
export interface GetStudentsDirectoryResponseDto {
    message?: string
    students?: CaseLoadStudentDto[]
    users?: CaseLoadStudentDto[]
    data?: any
    [key: string]: unknown
}

export interface ManualScoresApiError extends Error {
    status?: number
    data?: unknown
}

function resolveManualScoresApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.")
    }
    const trimmedPath = path.replace(/^\/+/, "")
    return `${AUTH_API_BASE_URL}/${trimmedPath}`
}

async function manualScoresApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveManualScoresApiUrl(path)

    const response = await fetch(url, {
        ...init,
        headers: buildJsonHeaders(init.headers),
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
        const message =
            body?.message ||
            body?.error ||
            response.statusText ||
            "An unknown error occurred while communicating with the server."

        const error = new Error(message) as ManualScoresApiError
        error.status = response.status
        error.data = body ?? text
        throw error
    }

    return data as T
}

function extractArray<T = any>(json: any): T[] {
    if (Array.isArray(json)) return json as T[]

    const candidates = [
        json?.students,
        json?.users,
        json?.data,
        json?.data?.students,
        json?.data?.users,
        json?.result,
        json?.results,
        json?.items,
    ]

    for (const c of candidates) {
        if (Array.isArray(c)) return c as T[]
    }

    return []
}

/**
 * ✅ Counselor case load
 * GET /counselor/case-load
 */
export async function getCounselorCaseLoadApi(): Promise<GetCaseLoadResponseDto> {
    return manualScoresApiFetch<GetCaseLoadResponseDto>("/counselor/case-load", {
        method: "GET",
    })
}

/**
 * ✅ Student users directory (fallback when case-load is empty/unavailable)
 * Tries common endpoints used in this project:
 * - GET /students
 * - GET /users?role=student
 * - GET /users?account_type=student
 * - GET /counselor/students
 */
export async function getStudentUsersApi(): Promise<GetStudentsDirectoryResponseDto> {
    const tryPaths = [
        "/students",
        "/users?role=student",
        "/users?account_type=student",
        "/counselor/students",
    ]

    let lastErr: any = null

    for (const path of tryPaths) {
        try {
            const json = await manualScoresApiFetch<any>(path, { method: "GET" })
            // If any of these shapes contain an array, treat it as a success
            const list = extractArray<CaseLoadStudentDto>(json)
            if (Array.isArray(list)) {
                return {
                    message: json?.message,
                    students: Array.isArray(json?.students) ? json.students : undefined,
                    users: Array.isArray(json?.users) ? json.users : undefined,
                    data: json?.data,
                    ...json,
                } as GetStudentsDirectoryResponseDto
            }
        } catch (e: any) {
            lastErr = e
            const status = Number(e?.status)
            if (status === 404 || status === 405) continue
            // other errors should stop early (auth, 500, etc.)
            throw e
        }
    }

    throw lastErr ?? new Error("Failed to fetch student users directory.")
}

/**
 * ✅ Save manual score
 * POST /counselor/manual-scores
 *
 * Laravel expects: assessed_date
 */
export async function saveManualScoreApi(payload: SaveManualScorePayload): Promise<SaveManualScoreResponseDto> {
    const body = {
        ...payload,
        assessed_date: payload.assessed_date ?? payload.date,
        date: payload.date ?? payload.assessed_date,
    }

    const json = await manualScoresApiFetch<any>("/counselor/manual-scores", {
        method: "POST",
        body: JSON.stringify(body),
    })

    const record = (json?.record ?? json?.scoreRecord ?? json?.data ?? json) as ManualAssessmentScoreDto

    return {
        message: json?.message,
        record,
    }
}

/**
 * ✅ List scores per student
 *
 * Your Laravel routes expose:
 * GET /counselor/manual-scores?student_id=123
 *
 * (We also try legacy path if you later add it.)
 */
export async function getStudentManualScoresApi(
    studentId: number | string,
): Promise<GetStudentManualScoresResponseDto> {
    const sid = encodeURIComponent(String(studentId))

    const tryPaths = [
        `/counselor/manual-scores?student_id=${sid}`,
        `/counselor/manual-scores/student/${sid}`, // legacy/optional
    ]

    let lastErr: any = null

    for (const path of tryPaths) {
        try {
            const json = await manualScoresApiFetch<any>(path, { method: "GET" })
            const scores = (json?.scores ?? json?.data ?? json) as ManualAssessmentScoreDto[]
            return { message: json?.message, scores: Array.isArray(scores) ? scores : [] }
        } catch (e: any) {
            lastErr = e
            const status = Number(e?.status)
            if (status === 404 || status === 405) continue
            throw e
        }
    }

    throw lastErr ?? new Error("Failed to fetch manual scores.")
}

/**
 * ✅ Counselor: list ALL manual scores (no student filter)
 * GET /counselor/manual-scores
 */
export async function getCounselorManualScoresApi(): Promise<GetStudentManualScoresResponseDto> {
    const tryPaths = [
        `/counselor/manual-scores`,
        `/counselor/manual-scores?student_id=`, // harmless fallback (backend ignores non-digit)
    ]

    let lastErr: any = null

    for (const path of tryPaths) {
        try {
            const json = await manualScoresApiFetch<any>(path, { method: "GET" })
            const scores = (json?.scores ?? json?.data ?? json) as ManualAssessmentScoreDto[]
            return { message: json?.message, scores: Array.isArray(scores) ? scores : [] }
        } catch (e: any) {
            lastErr = e
            const status = Number(e?.status)
            if (status === 404 || status === 405) continue
            throw e
        }
    }

    throw lastErr ?? new Error("Failed to fetch counselor manual scores.")
}

// re-export extractor (optional internal use)
export const __internal_extractArray = extractArray
