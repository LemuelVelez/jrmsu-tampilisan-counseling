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

export async function submitReferral(payload: CreateReferralPayload): Promise<ReferralDto> {
    const res = await createReferralApi(payload);
    return res.referral;
}

export async function fetchCounselorReferrals(params?: { status?: string; per_page?: number }): Promise<ReferralDto[]> {
    const res = await getCounselorReferralsApi({
        status: params?.status,
        per_page: params?.per_page ?? 100,
    });

    return Array.isArray(res?.referrals) ? res.referrals : [];
}

export async function fetchReferralUserReferrals(params?: { per_page?: number }): Promise<ReferralDto[]> {
    const res = await getReferralUserReferralsApi({
        per_page: params?.per_page ?? 100,
    });

    return Array.isArray(res?.referrals) ? res.referrals : [];
}

export async function fetchCounselorReferralById(id: number | string): Promise<ReferralDto> {
    const res = await getCounselorReferralByIdApi(id);
    return res.referral;
}

export async function updateCounselorReferral(id: number | string, payload: PatchReferralPayload): Promise<ReferralDto> {
    const res = await patchCounselorReferralApi(id, payload);
    return res.referral;
}

export async function changeReferralStatus(id: number | string, status: string): Promise<ReferralDto> {
    const updated = await updateCounselorReferral(id, { status });
    return updated;
}
