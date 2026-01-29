/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    getCounselorCaseLoadApi,
    getStudentManualScoresApi,
    getCounselorManualScoresApi,
    saveManualScoreApi,
    getStudentUsersApi,
    type CaseLoadStudentDto,
    type ManualAssessmentScoreDto,
    type SaveManualScorePayload,
    __internal_extractArray,
} from "@/api/manual-scores/route"

import { AUTH_API_BASE_URL } from "@/api/auth/route"

export type CaseLoadStudent = CaseLoadStudentDto
export type ManualScoreRecord = ManualAssessmentScoreDto

function looksLikeFilePath(s: string): boolean {
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads|storage)(\/|$)/i.test(s)
    )
}

function resolveAbsoluteUrl(raw: unknown): string | null {
    if (raw == null) return null
    let s = String(raw).trim()
    if (!s) return null

    s = s.replace(/\\/g, "/")

    if (/^(data:|blob:)/i.test(s)) return s
    if (/^https?:\/\//i.test(s)) return s

    if (s.startsWith("//")) {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "https:"
        return `${protocol}${s}`
    }

    if (!AUTH_API_BASE_URL) {
        if (!s.startsWith("/")) s = `/${s}`
        return s
    }

    let origin = AUTH_API_BASE_URL
    try {
        origin = new URL(AUTH_API_BASE_URL).origin
    } catch {
        // keep as-is
    }

    let p = s.replace(/^\/+/, "")
    const lower = p.toLowerCase()

    const alreadyStorage = lower.startsWith("storage/") || lower.startsWith("api/storage/")
    if (!alreadyStorage && looksLikeFilePath(p)) {
        // if backend serves files under /storage/...
        p = `storage/${p.replace(/^storage\/+/, "")}`
    }

    return `${origin}/${p}`
}

function normalizeStudent(raw: CaseLoadStudentDto): CaseLoadStudentDto {
    const anyR = raw as any

    const computedName =
        raw?.name ??
        anyR?.full_name ??
        anyR?.fullName ??
        anyR?.student_name ??
        anyR?.studentName ??
        anyR?.user?.name ??
        anyR?.student?.name ??
        (anyR?.first_name || anyR?.last_name
            ? `${anyR?.first_name ?? ""} ${anyR?.last_name ?? ""}`.trim()
            : null)

    const computedAvatar =
        resolveAbsoluteUrl(
            raw?.avatar_url ??
            anyR?.avatarUrl ??
            anyR?.profile_photo_url ??
            anyR?.user?.avatar_url ??
            anyR?.user?.avatarUrl ??
            null,
        ) ?? null

    return {
        ...raw,
        name: computedName != null && String(computedName).trim() ? String(computedName).trim() : raw?.name ?? null,
        avatar_url: computedAvatar ?? raw?.avatar_url ?? null,
        email: raw?.email ?? anyR?.user?.email ?? null,
        student_id: raw?.student_id ?? anyR?.student_id ?? anyR?.studentId ?? anyR?.user?.student_id ?? null,
        program: raw?.program ?? anyR?.program ?? anyR?.course ?? anyR?.user?.program ?? null,
        year_level: raw?.year_level ?? anyR?.year_level ?? anyR?.yearLevel ?? anyR?.user?.year_level ?? null,
    }
}

function extractStudentsFromAny(json: any): CaseLoadStudentDto[] {
    const arr = __internal_extractArray<CaseLoadStudentDto>(json)
    return Array.isArray(arr) ? arr : []
}

/**
 * ✅ Original: counselor case load (assigned students)
 * - Now made tolerant to different response shapes.
 */
export async function fetchCounselorCaseLoad(): Promise<CaseLoadStudentDto[]> {
    const res = await getCounselorCaseLoadApi()
    const list = extractStudentsFromAny(res)
    return list.map(normalizeStudent)
}

/**
 * ✅ NEW: fetch student users for manual score pages
 * Behavior:
 * 1) Try counselor case-load first (if endpoint exists and has assigned students)
 * 2) If empty or endpoint missing, fall back to general student directory endpoints (/students, /users?role=student, etc.)
 */
export async function fetchStudentsForManualScores(): Promise<CaseLoadStudentDto[]> {
    let firstErr: any = null

    try {
        const list = await fetchCounselorCaseLoad()
        if (Array.isArray(list) && list.length > 0) return list
    } catch (e: any) {
        firstErr = e
    }

    try {
        const res = await getStudentUsersApi()
        const list = extractStudentsFromAny(res)
        return list.map(normalizeStudent)
    } catch (e: any) {
        // If both fail, throw the most meaningful one
        throw firstErr ?? e ?? new Error("Failed to fetch student users.")
    }
}

export async function saveManualAssessmentScore(payload: SaveManualScorePayload): Promise<ManualAssessmentScoreDto> {
    const res = await saveManualScoreApi(payload)
    if (!res?.record) {
        throw new Error("Score saved but the server response did not include the created record.")
    }
    return res.record
}

export async function fetchStudentManualScores(studentId: number | string): Promise<ManualAssessmentScoreDto[]> {
    const res = await getStudentManualScoresApi(studentId)
    return res.scores ?? []
}

/**
 * ✅ Counselor: fetch ALL manual scores for reports
 */
export async function fetchCounselorManualScores(): Promise<ManualAssessmentScoreDto[]> {
    const res = await getCounselorManualScoresApi()
    return res.scores ?? []
}
