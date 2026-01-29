/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchCounselorAnalytics } from "@/lib/analytics"
import { fetchCounselorReferrals, type Referral } from "@/lib/referrals"
import {
  fetchCounselorMessages,
  fetchReferralUserMessages,
  fetchStudentMessages,
  type CounselorMessage,
  type ReferralUserMessage,
  type StudentMessage,
} from "@/lib/messages"
import { fetchCounselorManualScores, type ManualScoreRecord } from "@/lib/manual-scores"
import { fetchCounselorAssessments } from "@/lib/intake"
import { fetchNotificationCounts } from "@/lib/notifications"

import type { CounselorAnalyticsResponseDto, AnalyticsQuery } from "@/api/analytics/route"
import type { NotificationCountsResponseDto } from "@/api/notifications/route"
import type { CounselorAssessmentRecordDto } from "@/api/intake/route"

export type AdminAnalyticsQuery = AnalyticsQuery

export type SourceStatus = {
  key: string
  ok: boolean
  message?: string
}

export type AdminAnalyticsSnapshot = {
  counselorAnalytics: CounselorAnalyticsResponseDto | null
  referrals: Referral[]
  messages: Array<CounselorMessage | ReferralUserMessage | StudentMessage>
  manualScores: ManualScoreRecord[]
  assessments: CounselorAssessmentRecordDto[]
  notificationCounts: NotificationCountsResponseDto | null
  sources: SourceStatus[]
}

function errToMessage(e: any): string {
  return (
    e?.message ||
    e?.data?.message ||
    e?.data?.error ||
    e?.statusText ||
    "Request failed"
  )
}

export async function fetchAdminAnalyticsSnapshot(
  query?: AdminAnalyticsQuery,
): Promise<AdminAnalyticsSnapshot> {
  const sources: SourceStatus[] = []

  const tasks = [
    {
      key: "counselor_analytics",
      run: async () => fetchCounselorAnalytics(query),
    },
    {
      key: "counselor_referrals",
      run: async () => fetchCounselorReferrals({ per_page: 1000 }),
    },
    {
      key: "counselor_messages",
      run: async () => fetchCounselorMessages(),
    },
    {
      key: "referral_user_messages",
      run: async () => fetchReferralUserMessages(),
    },
    {
      key: "student_messages",
      run: async () => fetchStudentMessages(),
    },
    {
      key: "manual_scores",
      run: async () => fetchCounselorManualScores(),
    },
    {
      key: "counselor_assessments",
      run: async () => fetchCounselorAssessments(),
    },
    {
      key: "notifications_counts",
      run: async () => fetchNotificationCounts(),
    },
  ] as const

  const results = await Promise.allSettled(tasks.map((t) => t.run()))

  let counselorAnalytics: CounselorAnalyticsResponseDto | null = null
  let referrals: Referral[] = []
  let messages: Array<CounselorMessage | ReferralUserMessage | StudentMessage> = []
  let manualScores: ManualScoreRecord[] = []
  let assessments: CounselorAssessmentRecordDto[] = []
  let notificationCounts: NotificationCountsResponseDto | null = null

  results.forEach((r, idx) => {
    const key = tasks[idx].key

    if (r.status === "fulfilled") {
      sources.push({ key, ok: true })

      if (key === "counselor_analytics") {
        counselorAnalytics = r.value as any
      }

      if (key === "counselor_referrals") {
        referrals = Array.isArray(r.value) ? (r.value as any) : []
      }

      if (key === "counselor_messages" || key === "referral_user_messages" || key === "student_messages") {
        const res = r.value as any
        const arr = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : []
        messages = messages.concat(arr)
      }

      if (key === "manual_scores") {
        manualScores = Array.isArray(r.value) ? (r.value as any) : []
      }

      if (key === "counselor_assessments") {
        assessments = Array.isArray(r.value) ? (r.value as any) : []
      }

      if (key === "notifications_counts") {
        notificationCounts = r.value as any
      }
    } else {
      sources.push({ key, ok: false, message: errToMessage(r.reason) })
    }
  })

  // De-dupe messages by id
  const seen = new Set<string>()
  messages = messages.filter((m: any) => {
    const id = m?.id == null ? "" : String(m.id)
    if (!id) return false
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  return {
    counselorAnalytics,
    referrals,
    messages,
    manualScores,
    assessments,
    notificationCounts,
    sources,
  }
}
