import {
    createReferralApi,
    getCounselorReferralByIdApi,
    getCounselorReferralsApi,
    getReferralUserReferralsApi,
    patchCounselorReferralApi,
    type CreateReferralPayload,
    type PatchReferralPayload,
    type ReferralDto,
} from "@/api/referrals/route";

export type Referral = ReferralDto;

export async function submitReferral(payload: CreateReferralPayload, token?: string | null): Promise<ReferralDto> {
    const res = await createReferralApi(payload, token);
    return res.referral;
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
    );

    return Array.isArray(res?.referrals) ? res.referrals : [];
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
    );

    return Array.isArray(res?.referrals) ? res.referrals : [];
}

export async function fetchCounselorReferralById(id: number | string, token?: string | null): Promise<ReferralDto> {
    const res = await getCounselorReferralByIdApi(id, token);
    return res.referral;
}

export async function updateCounselorReferral(
    id: number | string,
    payload: PatchReferralPayload,
    token?: string | null,
): Promise<ReferralDto> {
    const res = await patchCounselorReferralApi(id, payload, token);
    return res.referral;
}

export async function changeReferralStatus(
    id: number | string,
    status: string,
    token?: string | null,
): Promise<ReferralDto> {
    const updated = await updateCounselorReferral(id, { status }, token);
    return updated;
}
