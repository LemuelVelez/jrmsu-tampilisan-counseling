import { getNotificationCountsApi, type NotificationCountsResponseDto } from "@/api/notifications/route";

export async function fetchNotificationCounts(): Promise<NotificationCountsResponseDto> {
    return getNotificationCountsApi();
}
