import {
    createReferralApi,
    getCounselorReferralsApi,
    getReferralUserReferralsApi,
    updateReferralStatusApi,
    type CreateReferralPayload,
    type ReferralDto,
} from "@/api/referrals/route";

export type Referral = ReferralDto;

export async function submitReferral(payload: CreateReferralPayload): Promise<ReferralDto> {
    const res = await createReferralApi(payload);
    return res.referral;
}

export async function fetchCounselorReferrals(): Promise<ReferralDto[]> {
    const res = await getCounselorReferralsApi();
    return res.referrals;
}

export async function fetchReferralUserReferrals(): Promise<ReferralDto[]> {
    const res = await getReferralUserReferralsApi();
    return res.referrals;
}

export async function changeReferralStatus(id: number | string, status: string): Promise<ReferralDto> {
    const res = await updateReferralStatusApi(id, { status });
    return res.referral;
}
