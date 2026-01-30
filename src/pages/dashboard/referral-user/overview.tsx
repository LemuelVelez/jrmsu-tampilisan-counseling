/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { format, subDays } from "date-fns"

import DashboardLayout from "@/components/DashboardLayout"
import { getCurrentSession } from "@/lib/authentication"
import { fetchReferralUserReferrals } from "@/lib/referrals"

import { cn } from "@/lib/utils"
import { RefreshCw, MessageSquareText, FileText, CircleAlert, MailOpen } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts"

type SenderKind = "student" | "guest" | "counselor" | "system" | "referral_user"

type UiMessage = {
  id: number | string
  conversationId: string
  sender: SenderKind
  senderName: string
  content: string
  createdAt: string
  isUnread: boolean

  senderId?: number | string | null
  recipientId?: number | string | null
  recipientRole?: "counselor" | "student" | "guest" | "admin" | "referral_user" | null
  recipientName?: string | null
  userId?: number | string | null
}

type Conversation = {
  id: string
  peerName: string
  unreadCount: number
  lastMessage: string
  lastTimestamp: string
}

type UiReferral = {
  id: number | string
  studentName: string
  studentId: string
  concernType: string
  urgency: string
  status: string
  createdAt: string
}

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.")
  const trimmed = path.replace(/^\/+/, "")
  return `${API_BASE_URL}/${trimmed}`
}

function safeText(v: any, fallback = ""): string {
  if (v === null || v === undefined) return fallback
  const s = String(v).trim()
  return s || fallback
}

function safeLower(v: any): string {
  return safeText(v).toLowerCase()
}

function safeIso(iso?: any): string {
  const s = safeText(iso)
  if (!s) return new Date(0).toISOString()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString()
  return d.toISOString()
}

function formatShort(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return format(d, "MMM d")
}

function normalizeSender(raw: any): SenderKind {
  const s = String(raw ?? "").trim().toLowerCase()
  if (s === "student" || s === "guest" || s === "counselor" || s === "system") return s
  if (s === "referral_user" || s === "dean" || s === "registrar" || s === "program_chair") return "referral_user"
  return "system"
}

function isUnreadFlag(dto: any): boolean {
  return dto?.is_read === false || dto?.is_read === 0
}

function safeConversationId(dto: any): string {
  const raw = dto?.conversation_id ?? dto?.conversationId
  if (raw != null && String(raw).trim()) return String(raw)

  const userId = dto?.user_id ?? dto?.userId ?? null
  if (userId != null) return `referral_user-${userId}`

  return `general-${Date.now()}`
}

function mapDtoToUiMessage(dto: any): UiMessage {
  const sender = normalizeSender(dto?.sender)

  const senderName =
    (dto?.sender_name && String(dto.sender_name).trim()) ||
    (sender === "system"
      ? "Guidance & Counseling Office"
      : sender === "counselor"
        ? "Counselor"
        : "You")

  const recipientName =
    (dto?.recipient_name && String(dto.recipient_name).trim()) ||
    (dto?.recipientUser?.name && String(dto.recipientUser.name).trim()) ||
    (dto?.recipient_user?.name && String(dto.recipient_user.name).trim()) ||
    null

  const createdAt = dto?.created_at ?? new Date(0).toISOString()

  return {
    id: dto?.id ?? `${createdAt}-${sender}-${Math.random().toString(36).slice(2)}`,
    conversationId: safeConversationId(dto),
    sender,
    senderName,
    content: safeText(dto?.content),
    createdAt: safeIso(createdAt),
    isUnread: isUnreadFlag(dto),

    senderId: dto?.sender_id ?? null,
    recipientId: dto?.recipient_id ?? null,
    recipientRole: dto?.recipient_role ?? null,
    recipientName,
    userId: dto?.user_id ?? null,
  }
}

function buildConversationsForReferralUser(messages: UiMessage[], myUserId: string): Conversation[] {
  // Referral user module must ONLY show counselor conversations:
  // - outgoing: me(referral_user) -> counselor
  // - incoming: counselor -> me(referral_user)
  const visible = messages.filter((m) => {
    if (m.sender === "referral_user") {
      return String(m.senderId ?? "") === myUserId && m.recipientRole === "counselor"
    }
    if (m.sender === "counselor") {
      return m.recipientRole === "referral_user" && String(m.recipientId ?? "") === myUserId
    }
    return m.sender === "system"
  })

  const grouped = new Map<string, UiMessage[]>()
  for (const m of visible) {
    const arr = grouped.get(m.conversationId) ?? []
    arr.push(m)
    grouped.set(m.conversationId, arr)
  }

  const convs: Conversation[] = []

  for (const [id, msgs] of grouped.entries()) {
    const ordered = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const last = ordered[ordered.length - 1]
    const unreadCount = ordered.filter((m) => m.isUnread).length

    const counselorMsg = ordered.find((m) => m.sender === "counselor") ?? null
    const outbound = ordered.find((m) => m.sender === "referral_user" && m.recipientRole === "counselor") ?? null

    const peerName =
      (counselorMsg?.senderName && counselorMsg.senderName.trim()) ||
      (outbound?.recipientName && outbound.recipientName.trim()) ||
      "Counselor"

    convs.push({
      id,
      peerName,
      unreadCount,
      lastMessage: safeText(last?.content),
      lastTimestamp: safeIso(last?.createdAt),
    })
  }

  convs.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  })

  return convs
}

async function apiFetch(path: string, init: RequestInit, token?: string | null): Promise<any> {
  const url = resolveApiUrl(path)

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })

  const text = await res.text()
  let data: any = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || "Server request failed."
    const err: any = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

function extractArray(payload: any, keys: string[]): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  for (const k of keys) {
    if (Array.isArray(payload?.[k])) return payload[k]
  }
  return []
}

function mapDtoToUiReferral(dto: any): UiReferral {
  const studentId =
    safeText(dto?.student?.student_id) ||
    safeText(dto?.student?.studentId) ||
    safeText(dto?.student_id) ||
    safeText(dto?.studentId) ||
    ""

  const studentName =
    safeText(dto?.student_name) ||
    safeText(dto?.student?.name) ||
    (studentId ? `Student • ${studentId}` : "Student")

  const concernType =
    safeText(dto?.concern_type) ||
    safeText(dto?.concernType) ||
    safeText(dto?.concern) ||
    "N/A"

  const urgency =
    safeText(dto?.urgency) ||
    safeText(dto?.priority) ||
    "medium"

  const status = safeText(dto?.status, "pending") || "pending"
  const createdAt = safeIso(dto?.created_at)

  return {
    id: dto?.id ?? `${createdAt}-${Math.random().toString(36).slice(2)}`,
    studentName,
    studentId,
    concernType,
    urgency,
    status,
    createdAt,
  }
}

function chartColor(n: 1 | 2 | 3 | 4 | 5) {
  return `var(--chart-${n})`
}

function TooltipCard(props: any) {
  const { active, payload, label } = props
  if (!active || !payload || !payload.length) return null

  return (
    <Card className="border bg-white/95 shadow-sm backdrop-blur">
      <CardContent className="p-3">
        <div className="text-xs font-semibold text-slate-900">{safeText(label, "")}</div>
        <div className="mt-2 space-y-1">
          {payload.slice(0, 6).map((p: any, idx: number) => {
            const name = safeText(p?.name ?? p?.dataKey ?? "Value")
            const val = p?.value
            return (
              <div key={`${name}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{name}</span>
                <span className="font-semibold text-slate-900">{String(val ?? "")}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

const ReferralUserOverview: React.FC = () => {
  const session = getCurrentSession()
  const token = (session as any)?.token ?? (session as any)?.access_token ?? null

  const myName =
    session?.user && (session.user as any).name ? String((session.user as any).name) : "Referral User"
  const myUserId = session?.user?.id != null ? String(session.user.id) : ""

  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const [referrals, setReferrals] = React.useState<UiReferral[]>([])
  const [messages, setMessages] = React.useState<UiMessage[]>([])

  // ✅ used for "Last updated" label (avoids useMemo deps warnings)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<string>(() => new Date().toISOString())

  const load = async (mode: "initial" | "refresh" = "refresh") => {
    const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing
    setBusy(true)

    try {
      // Referrals
      const list = await fetchReferralUserReferrals({ per_page: 100 }, token)
      const mappedReferrals = (Array.isArray(list) ? list : []).map(mapDtoToUiReferral)
      setReferrals(mappedReferrals)

      // Messages
      const raw = await apiFetch("/referral-user/messages", { method: "GET" }, token)
      const arr = extractArray(raw, ["messages", "data", "results", "items", "records"])
      const mappedMsgs = (Array.isArray(arr) ? arr : []).map(mapDtoToUiMessage)
      setMessages(mappedMsgs)

      // ✅ only update "Last updated" after successful load
      setLastUpdatedAt(new Date().toISOString())
    } catch (err: any) {
      const status = err?.status
      const msg =
        status === 401
          ? "Unauthorized (401). Please log in again."
          : status === 403
            ? "Forbidden (403). Your role is not allowed to access this dashboard."
            : err instanceof Error
              ? err.message
              : "Failed to load overview."
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    void load("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = async () => {
    if (isLoading || isRefreshing) return
    await load("refresh")
  }

  const referralCounts = React.useMemo(() => {
    const total = referrals.length
    const pending = referrals.filter((r) => safeLower(r.status) === "pending").length
    const handled = referrals.filter((r) => safeLower(r.status) === "handled").length
    const closed = referrals.filter((r) => safeLower(r.status) === "closed").length
    const other = Math.max(0, total - pending - handled - closed)
    return { total, pending, handled, closed, other }
  }, [referrals])

  const urgencyCounts = React.useMemo(() => {
    const low = referrals.filter((r) => safeLower(r.urgency) === "low").length
    const medium = referrals.filter((r) => safeLower(r.urgency) === "medium").length
    const high = referrals.filter((r) => safeLower(r.urgency) === "high").length
    const total = referrals.length
    const other = Math.max(0, total - low - medium - high)
    return { low, medium, high, other, total }
  }, [referrals])

  const conversations = React.useMemo(
    () => buildConversationsForReferralUser(messages, myUserId),
    [messages, myUserId],
  )

  const messageStats = React.useMemo(() => {
    const totalMessages = messages.length
    const unreadMessages = messages.filter((m) => m.isUnread).length
    const totalThreads = conversations.length
    const unreadThreads = conversations.filter((c) => c.unreadCount > 0).length
    return { totalMessages, unreadMessages, totalThreads, unreadThreads }
  }, [messages, conversations])

  const statusPie = React.useMemo(() => {
    const items = [
      { name: "Pending", value: referralCounts.pending, fill: chartColor(1) },
      { name: "Handled", value: referralCounts.handled, fill: chartColor(2) },
      { name: "Closed", value: referralCounts.closed, fill: chartColor(3) },
    ]
    if (referralCounts.other > 0) items.push({ name: "Other", value: referralCounts.other, fill: chartColor(4) })
    return items.filter((x) => x.value > 0)
  }, [referralCounts])

  const urgencyBar = React.useMemo(() => {
    const items = [
      { name: "Low", value: urgencyCounts.low },
      { name: "Medium", value: urgencyCounts.medium },
      { name: "High", value: urgencyCounts.high },
    ]
    if (urgencyCounts.other > 0) items.push({ name: "Other", value: urgencyCounts.other })
    return items
  }, [urgencyCounts])

  const referralsByMonth = React.useMemo(() => {
    // last 6 months (rolling) based on current date
    const now = new Date()
    const buckets: Array<{ key: string; label: string; count: number }> = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      buckets.push({ key, label: format(d, "MMM"), count: 0 })
    }

    const idx = new Map(buckets.map((b, i) => [b.key, i]))

    for (const r of referrals) {
      const d = new Date(r.createdAt)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const i = idx.get(key)
      if (i != null) buckets[i].count += 1
    }

    return buckets.map((b) => ({ name: b.label, Referrals: b.count }))
  }, [referrals])

  const messagesByDay = React.useMemo(() => {
    const today = new Date()
    const days: Array<{ key: string; label: string; count: number }> = []

    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i)
      const key = format(d, "yyyy-MM-dd")
      days.push({ key, label: format(d, "EEE"), count: 0 })
    }

    const idx = new Map(days.map((x, i) => [x.key, i]))

    for (const m of messages) {
      const d = new Date(m.createdAt)
      if (Number.isNaN(d.getTime())) continue
      const key = format(d, "yyyy-MM-dd")
      const i = idx.get(key)
      if (i != null) days[i].count += 1
    }

    return days.map((d) => ({ name: d.label, Messages: d.count }))
  }, [messages])

  const recentReferrals = React.useMemo(() => {
    return [...referrals]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [referrals])

  const recentThreads = React.useMemo(() => {
    return [...conversations].slice(0, 8)
  }, [conversations])

  const lastUpdatedLabel = React.useMemo(() => {
    const d = new Date(lastUpdatedAt)
    if (Number.isNaN(d.getTime())) return "—"
    return format(d, "MMM d, yyyy • h:mm a")
  }, [lastUpdatedAt])

  return (
    <DashboardLayout title="Overview" description="A quick summary of your Referrals and Messages.">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Card className="border bg-white/70 shadow-sm backdrop-blur">
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Referral User Dashboard</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Welcome, {myName}. Track your activity at a glance.
                </CardDescription>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Badge variant="secondary" className="h-9 w-fit px-3 text-xs">
                  Last updated: {lastUpdatedLabel}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full sm:w-auto"
                  onClick={refresh}
                  disabled={isLoading || isRefreshing}
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                  Refresh
                </Button>

                <Button asChild className="h-10 w-full sm:w-auto">
                  <Link to="/dashboard/referral-user/referrals">
                    <FileText className="mr-2 h-4 w-4" />
                    Referrals
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
                  <Link to="/dashboard/referral-user/messages">
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Messages
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardDescription className="text-xs">Total Referrals</CardDescription>
              <CardTitle className="text-2xl">{referralCounts.total}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="gap-1">
                  <CircleAlert className="h-3.5 w-3.5" />
                  Pending: {referralCounts.pending}
                </Badge>
                <Badge variant="default" className="gap-1">
                  Handled: {referralCounts.handled}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  Closed: {referralCounts.closed}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardDescription className="text-xs">High Urgency</CardDescription>
              <CardTitle className="text-2xl">{urgencyCounts.high}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground">
                Medium: <span className="font-semibold text-slate-900">{urgencyCounts.medium}</span> • Low:{" "}
                <span className="font-semibold text-slate-900">{urgencyCounts.low}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardDescription className="text-xs">Unread Threads</CardDescription>
              <CardTitle className="text-2xl">{messageStats.unreadThreads}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground">
                Total threads: <span className="font-semibold text-slate-900">{messageStats.totalThreads}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardDescription className="text-xs">Unread Messages</CardDescription>
              <CardTitle className="text-2xl">{messageStats.unreadMessages}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MailOpen className="h-4 w-4" />
                Total messages: <span className="font-semibold text-slate-900">{messageStats.totalMessages}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Referral Status Distribution</CardTitle>
              <CardDescription className="text-xs">Pending vs Handled vs Closed</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  Loading chart…
                </div>
              ) : statusPie.length === 0 ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  No referral data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip content={<TooltipCard />} />
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      stroke="var(--border)"
                      strokeWidth={1}
                    >
                      {statusPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Urgency Breakdown</CardTitle>
              <CardDescription className="text-xs">Low / Medium / High</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  Loading chart…
                </div>
              ) : urgencyCounts.total === 0 ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  No referral data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={urgencyBar} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <RechartsTooltip content={<TooltipCard />} />
                    <Bar dataKey="value" name="Count" fill={chartColor(4)} radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Referrals Trend</CardTitle>
              <CardDescription className="text-xs">Last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={referralsByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <RechartsTooltip content={<TooltipCard />} />
                    <Line
                      type="monotone"
                      dataKey="Referrals"
                      stroke={chartColor(1)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Messages Activity</CardTitle>
              <CardDescription className="text-xs">Last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={messagesByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <RechartsTooltip content={<TooltipCard />} />
                    <Line
                      type="monotone"
                      dataKey="Messages"
                      stroke={chartColor(2)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Recent Referrals</CardTitle>
              <CardDescription className="text-xs">Latest submissions</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-112">
                <div className="p-3 sm:p-4">
                  {isLoading ? (
                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : recentReferrals.length === 0 ? (
                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                      No referrals yet.
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-white/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="w-24 text-right">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentReferrals.map((r) => (
                            <TableRow key={String(r.id)} className="hover:bg-white">
                              <TableCell>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {r.studentName}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    Student ID: {r.studentId || "—"} • {r.concernType}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    safeLower(r.status) === "pending"
                                      ? "secondary"
                                      : safeLower(r.status) === "handled"
                                        ? "default"
                                        : "outline"
                                  }
                                  className="capitalize"
                                >
                                  {safeText(r.status, "pending")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {formatShort(r.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t bg-white/60 p-3 sm:p-4">
                <Button asChild variant="outline" className="h-10 w-full">
                  <Link to="/dashboard/referral-user/referrals">Open Referrals</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">Recent Conversations</CardTitle>
              <CardDescription className="text-xs">Counselor threads</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-112">
                <div className="space-y-2 p-3 sm:p-4">
                  {isLoading ? (
                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : recentThreads.length === 0 ? (
                    <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
                      No conversations yet.
                    </div>
                  ) : (
                    recentThreads.map((c) => (
                      <div key={c.id} className="rounded-xl border bg-white/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {c.peerName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.lastMessage || "No messages yet."}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {c.unreadCount > 0 ? (
                              <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">
                                {c.unreadCount}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="h-6 px-2 text-[0.70rem]">
                                Read
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatShort(c.lastTimestamp)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Button asChild variant="outline" className="h-9 w-full text-xs">
                            <Link to="/dashboard/referral-user/messages">Open Messages</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default ReferralUserOverview
