import { getCounselorAnalyticsApi, type AnalyticsQuery, type CounselorAnalyticsResponseDto } from "@/api/analytics/route";

export async function fetchCounselorAnalytics(query?: AnalyticsQuery): Promise<CounselorAnalyticsResponseDto> {
    return getCounselorAnalyticsApi(query);
}
