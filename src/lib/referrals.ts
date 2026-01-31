/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    createReferralApi,
    getCounselorReferralByIdApi,
    getCounselorReferralsApi,
    getReferralUserReferralsApi,
    patchCounselorReferralApi,
    type CreateReferralPayload,
    type PatchReferralPayload,
    type ReferralDto,
} from "@/api/referrals/route"

export type Referral = ReferralDto

export async function submitReferral(payload: CreateReferralPayload, token?: string | null): Promise<ReferralDto> {
    const res = await createReferralApi(payload, token)
    return res.referral
}

export async function fetchCounselorReferrals(
    params?: { status?: string; per_page?: number },
    token?: string | null,
): Promise<ReferralDto[]> {
    const res = await getCounselorReferralsApi(
        {
            status: params?.status,
            per_page: params?.per_page ?? 100,
        },
        token,
    )

    return Array.isArray(res?.referrals) ? res.referrals : []
}

export async function fetchReferralUserReferrals(
    params?: { per_page?: number },
    token?: string | null,
): Promise<ReferralDto[]> {
    const res = await getReferralUserReferralsApi(
        {
            per_page: params?.per_page ?? 100,
        },
        token,
    )

    return Array.isArray(res?.referrals) ? res.referrals : []
}

export async function fetchCounselorReferralById(id: number | string, token?: string | null): Promise<ReferralDto> {
    const res = await getCounselorReferralByIdApi(id, token)
    return res.referral
}

function normalizeCounselorId(value: unknown): number | string | null {
    if (value == null) return null

    // allow empty string to behave like null (unassign)
    if (typeof value === "string") {
        const s = value.trim()
        if (!s) return null
        if (/^\d+$/.test(s)) return Number(s)
        return s
    }

    if (typeof value === "number") return value

    // fallback
    const s = String(value).trim()
    if (!s) return null
    if (/^\d+$/.test(s)) return Number(s)
    return s
}

export async function updateCounselorReferral(
    id: number | string,
    payload: PatchReferralPayload,
    token?: string | null,
): Promise<ReferralDto> {
    // ✅ Make backend validator happy (integer exists:users,id)
    const normalized: PatchReferralPayload = { ...payload }

    if (Object.prototype.hasOwnProperty.call(normalized, "counselor_id")) {
        normalized.counselor_id = normalizeCounselorId((normalized as any).counselor_id)
    }

    const res = await patchCounselorReferralApi(id, normalized, token)
    return res.referral
}

export async function changeReferralStatus(
    id: number | string,
    status: string,
    token?: string | null,
): Promise<ReferralDto> {
    const updated = await updateCounselorReferral(id, { status }, token)
    return updated
}
