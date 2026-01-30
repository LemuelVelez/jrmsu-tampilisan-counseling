/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { toast } from "sonner"
import { format } from "date-fns"
import { getCurrentSession } from "@/lib/authentication"

import { cn } from "@/lib/utils"
import {
    Check,
    ChevronsUpDown,
    MoreVertical,
    Pencil,
    RefreshCw,
    Trash2,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

    senderAvatarUrl?: string | null
    recipientAvatarUrl?: string | null
}

type Conversation = {
    id: string
    peerRole: "counselor"
    peerName: string
    peerId?: number | string | null

    subtitle: string
    unreadCount: number
    lastMessage?: string
    lastTimestamp?: string
    peerAvatarUrl?: string | null
}

type DirectoryUser = {
    id: number | string
    name: string
    role: "counselor"
    email?: string | null
    avatar_url?: string | null
}

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined

function resolveApiUrl(path: string): string {
    if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.")
    const trimmed = path.replace(/^\/+/, "")
    return `${API_BASE_URL}/${trimmed}`
}

function getApiOrigin(): string {
    if (!API_BASE_URL) return ""
    try {
        return new URL(API_BASE_URL).origin
    } catch {
        return ""
    }
}

function looksLikeFilePath(s: string): boolean {
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    )
}

function resolveAvatarSrc(raw?: string | null): string | null {
    const s0 = typeof raw === "string" ? raw : ""
    let s = s0.trim()
    if (!s) return null

    s = s.replace(/\\/g, "/")
    if (/^(data:|blob:)/i.test(s)) return s

    if (/^https?:\/\//i.test(s)) {
        try {
            const u = new URL(s)
            const p = (u.pathname || "").replace(/\\/g, "/")

            u.pathname = p
                .replace(/^\/api\/storage\//i, "/storage/")
                .replace(/^\/api\/public\/storage\//i, "/storage/")
                .replace(/^\/storage\/app\/public\//i, "/storage/")

            return u.toString()
        } catch {
            return s
        }
    }

    if (s.startsWith("//")) return `${window.location.protocol}${s}`

    s = s.replace(/^storage\/app\/public\//i, "")
    s = s.replace(/^public\//i, "")

    const normalized = s.replace(/^\/+/, "")
    const alreadyStorage =
        normalized.toLowerCase().startsWith("storage/") ||
        normalized.toLowerCase().startsWith("api/storage/")

    let path = normalized
    if (!alreadyStorage && looksLikeFilePath(normalized)) {
        path = `storage/${normalized}`
    }

    path = path.replace(/^api\/storage\//i, "storage/")

    const finalPath = path.startsWith("/") ? path : `/${path}`
    const origin = getApiOrigin()
    return origin ? `${origin}${finalPath}` : finalPath
}

function initials(name: string) {
    const cleaned = (name || "").trim()
    if (!cleaned) return "RU"
    const parts = cleaned.split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "RU"
}

const formatTimestamp = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, "MMM d, yyyy • h:mm a")
}

const formatShort = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "MMM d")
}

function pickAvatarUrl(obj: any): string | null {
    const candidates = [
        obj?.avatar_url,
        obj?.avatarUrl,
        obj?.avatar,
        obj?.profile_picture_url,
        obj?.profile_photo_url,
        obj?.photo_url,
        obj?.image_url,

        obj?.sender_avatar_url,
        obj?.recipient_avatar_url,
    ]

    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim()
    }

    const nested = [obj?.user, obj?.sender, obj?.sender_user, obj?.senderUser, obj?.recipient, obj?.recipient_user, obj?.recipientUser]
    for (const n of nested) {
        if (!n) continue
        const v =
            (typeof n?.avatar_url === "string" && n.avatar_url.trim()) ||
            (typeof n?.profile_photo_url === "string" && n.profile_photo_url.trim()) ||
            ""
        if (v) return String(v).trim()
    }

    return null
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
        err.data = data ?? text
        throw err
    }

    return data
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    const candidates = [payload.users, payload.data, payload.results, payload.items, payload.records]
    for (const c of candidates) if (Array.isArray(c)) return c
    return []
}

function extractMessagesArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    const candidates = [payload.messages, payload.data, payload.results, payload.items, payload.records]
    for (const c of candidates) if (Array.isArray(c)) return c
    return []
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

function mapDtoToUi(dto: any): UiMessage {
    const sender = normalizeSender(dto?.sender)

    const senderName =
        (dto?.sender_name && String(dto.sender_name).trim()) ||
        (sender === "system"
            ? "Guidance & Counseling Office"
            : sender === "counselor"
                ? "Counselor"
                : "You")

    const createdAt = dto?.created_at ?? new Date(0).toISOString()

    const senderAvatarUrl = pickAvatarUrl(dto) ?? pickAvatarUrl(dto?.sender_user) ?? pickAvatarUrl(dto?.senderUser) ?? null
    const recipientAvatarUrl = pickAvatarUrl(dto?.recipient_user) ?? pickAvatarUrl(dto?.recipientUser) ?? null

    const recipientName =
        (dto?.recipient_name && String(dto.recipient_name).trim()) ||
        (dto?.recipientUser?.name && String(dto.recipientUser.name).trim()) ||
        (dto?.recipient_user?.name && String(dto.recipient_user.name).trim()) ||
        null

    return {
        id: dto?.id ?? `${createdAt}-${sender}-${Math.random().toString(36).slice(2)}`,
        conversationId: safeConversationId(dto),

        sender,
        senderName,
        content: dto?.content ?? "",
        createdAt,

        isUnread: isUnreadFlag(dto),

        senderId: dto?.sender_id ?? null,
        recipientId: dto?.recipient_id ?? null,
        recipientRole: dto?.recipient_role ?? null,
        recipientName,

        userId: dto?.user_id ?? null,

        senderAvatarUrl,
        recipientAvatarUrl,
    }
}

function buildConversations(messages: UiMessage[]): Conversation[] {
    const grouped = new Map<string, UiMessage[]>()
    for (const m of messages) {
        const arr = grouped.get(m.conversationId) ?? []
        arr.push(m)
        grouped.set(m.conversationId, arr)
    }

    const convs: Conversation[] = []

    for (const [conversationId, msgs] of grouped.entries()) {
        const ordered = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        const last = ordered[ordered.length - 1]
        const unreadCount = ordered.filter((m) => m.isUnread).length

        const counselorMsg = ordered.find((m) => m.sender === "counselor") ?? null
        const outbound = ordered.find((m) => m.sender === "referral_user" && m.recipientRole === "counselor") ?? last

        const peerName = counselorMsg
            ? (counselorMsg.senderName || "Counselor")
            : (outbound.recipientName || "Counselor")

        const peerId = counselorMsg
            ? (counselorMsg.senderId ?? counselorMsg.recipientId ?? null)
            : (outbound.recipientId ?? null)

        const peerAvatarUrl = counselorMsg
            ? (counselorMsg.senderAvatarUrl ?? null)
            : (outbound.recipientAvatarUrl ?? null)

        convs.push({
            id: conversationId,
            peerRole: "counselor",
            peerName,
            peerId,
            subtitle: "Counselor thread",
            unreadCount,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
            peerAvatarUrl,
        })
    }

    convs.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
        const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0
        const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0
        return tb - ta
    })

    return convs
}

function isNumericId(id: unknown): boolean {
    if (typeof id === "number") return Number.isInteger(id)
    if (typeof id === "string") return /^\d+$/.test(id.trim())
    return false
}

function normalizeIdToNumberOrNull(id: unknown): number | null {
    if (!isNumericId(id)) return null
    const n = typeof id === "number" ? id : Number.parseInt(String(id), 10)
    return Number.isFinite(n) ? n : null
}

/**
 * ✅ Referral user should ONLY use referral-user endpoints.
 */
async function tryFetchReferralUserMessages(token?: string | null): Promise<any[]> {
    const data = await apiFetch("/referral-user/messages", { method: "GET" }, token)
    return extractMessagesArray(data)
}

async function trySendReferralUserMessage(payload: any, token?: string | null): Promise<any> {
    return apiFetch("/referral-user/messages", { method: "POST", body: JSON.stringify(payload) }, token)
}

async function tryMarkMessagesAsRead(ids: number[], token?: string | null) {
    await apiFetch("/referral-user/messages/mark-as-read", { method: "POST", body: JSON.stringify({ message_ids: ids }) }, token)
}

/**
 * Delete (hide) a conversation for the current user
 */
async function tryDeleteConversationApi(conversationId: string, token?: string | null) {
    const candidates = [
        `/messages/conversations/${encodeURIComponent(conversationId)}`,
        `/conversations/${encodeURIComponent(conversationId)}`,
        `/messages/thread/${encodeURIComponent(conversationId)}`,
    ]

    let lastErr: any = null
    for (const p of candidates) {
        try {
            await apiFetch(p, { method: "DELETE" }, token)
            return
        } catch (e) {
            lastErr = e
        }
    }

    throw lastErr ?? new Error("Failed to delete conversation.")
}

/**
 * ✅ Update a single message (edit)
 */
async function tryUpdateMessageApi(messageId: number, content: string, token?: string | null): Promise<any> {
    const id = encodeURIComponent(String(messageId))
    const methods: Array<"PATCH" | "PUT"> = ["PATCH", "PUT"]

    let lastErr: any = null
    for (const method of methods) {
        try {
            const data = await apiFetch(`/messages/${id}`, { method, body: JSON.stringify({ content }) }, token)
            return data
        } catch (e) {
            lastErr = e
        }
    }

    throw lastErr ?? new Error("Failed to update message.")
}

/**
 * ✅ Delete a single message
 */
async function tryDeleteMessageApi(messageId: number, token?: string | null): Promise<any> {
    const id = encodeURIComponent(String(messageId))
    return apiFetch(`/messages/${id}`, { method: "DELETE" }, token)
}

async function trySearchCounselorsFromDb(query: string, token?: string | null): Promise<DirectoryUser[]> {
    const q = query.trim()
    const qq = encodeURIComponent(q)

    const candidates = [
        `/counselors?search=${qq}`,
        `/counselors/search?q=${qq}`,
        `/counselors?q=${qq}`,

        `/users?role=counselor&search=${qq}`,
        `/users/search?role=counselor&q=${qq}`,
    ]

    let lastErr: any = null

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET" }, token)
            const arr = extractUsersArray(data)

            const mapped: DirectoryUser[] = arr
                .map((raw: any) => raw?.user ?? raw)
                .map((u: any) => {
                    const id = u?.id ?? u?.user_id ?? u?.account_id
                    if (id == null || String(id).trim() === "") return null

                    const name =
                        (u?.name && String(u.name).trim()) ||
                        (u?.full_name && String(u.full_name).trim()) ||
                        "Counselor"

                    const email = typeof u?.email === "string" ? u.email : null

                    const role = String(u?.role ?? "").toLowerCase()
                    const isCounselor =
                        role.includes("counselor") || role.includes("counsellor") || role.includes("guidance")
                    if (!isCounselor) return null

                    return {
                        id,
                        name,
                        role: "counselor",
                        email,
                        avatar_url: pickAvatarUrl(u) ?? null,
                    } as DirectoryUser
                })
                .filter(Boolean) as DirectoryUser[]

            const seen = new Set<string>()
            return mapped.filter((u) => {
                const k = String(u.id)
                if (seen.has(k)) return false
                seen.add(k)
                return true
            })
        } catch (e) {
            lastErr = e
        }
    }

    throw lastErr ?? new Error("Failed to search counselors.")
}

function UserCombobox(props: {
    users: DirectoryUser[]
    value: DirectoryUser | null
    onChange: (u: DirectoryUser) => void

    searchValue: string
    onSearchValueChange: (v: string) => void
    isLoading?: boolean
}) {
    const { users, value, onChange, searchValue, onSearchValueChange, isLoading } = props
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between">
                    <span className={cn("min-w-0 truncate text-left", !value ? "text-muted-foreground" : "")}>
                        {value ? `${value.name} • ID: ${value.id}` : "Select counselor…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Type name or ID…"
                        value={searchValue}
                        onValueChange={(v) => onSearchValueChange(v)}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {isLoading ? "Searching…" : searchValue.trim().length < 2 ? "Type at least 2 characters." : "No counselors found."}
                        </CommandEmpty>
                        <CommandGroup>
                            {users.map((u) => {
                                const selected = !!value && String(value.id) === String(u.id)
                                return (
                                    <CommandItem
                                        key={String(u.id)}
                                        value={`${u.name} ${u.id} ${u.email ?? ""}`}
                                        onSelect={() => {
                                            onChange(u)
                                            setOpen(false)
                                        }}
                                        className="gap-2"
                                    >
                                        <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm">{u.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                Counselor • ID: {u.id}
                                                {u.email ? ` • ${u.email}` : ""}
                                            </div>
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const ReferralUserMessages: React.FC = () => {
    const session = getCurrentSession()
    const token = (session as any)?.token ?? (session as any)?.access_token ?? null

    const myName = session?.user && (session.user as any).name ? String((session.user as any).name) : "Referral User"
    const myUserId = session?.user?.id != null ? String(session.user.id) : ""

    const [isLoading, setIsLoading] = React.useState(true)
    const [isRefreshing, setIsRefreshing] = React.useState(false)
    const [isSending, setIsSending] = React.useState(false)
    const [isMarking, setIsMarking] = React.useState(false)

    const [search, setSearch] = React.useState("")
    const [mobileView, setMobileView] = React.useState<"list" | "chat">("list")

    const [draft, setDraft] = React.useState("")
    const [messages, setMessages] = React.useState<UiMessage[]>([])
    const [activeConversationId, setActiveConversationId] = React.useState<string>("")

    const [showNewMessage, setShowNewMessage] = React.useState(false)
    const [recipientQuery, setRecipientQuery] = React.useState("")
    const [recipientResults, setRecipientResults] = React.useState<DirectoryUser[]>([])
    const [recipientLoading, setRecipientLoading] = React.useState(false)
    const [newRecipient, setNewRecipient] = React.useState<DirectoryUser | null>(null)

    const bottomRef = React.useRef<HTMLDivElement | null>(null)

    const [deleteConvoOpen, setDeleteConvoOpen] = React.useState(false)
    const [isDeletingConvo, setIsDeletingConvo] = React.useState(false)

    const [editingMessageId, setEditingMessageId] = React.useState<string>("")
    const [editDraft, setEditDraft] = React.useState("")
    const [isUpdatingMessage, setIsUpdatingMessage] = React.useState(false)

    const [deleteMessageOpen, setDeleteMessageOpen] = React.useState(false)
    const [deleteTarget, setDeleteTarget] = React.useState<UiMessage | null>(null)
    const [isDeletingMessage, setIsDeletingMessage] = React.useState(false)

    // ✅ Track threads the user ACTUALLY opened on this page
    // (So we only auto-mark-read after open OR after sending a reply.)
    const openedConversationIdsRef = React.useRef(new Set<string>())

    // ✅ Avoid duplicate mark-read calls per thread
    const markInflightRef = React.useRef(new Set<string>())

    const openConversation = React.useCallback((conversationId: string) => {
        if (!conversationId) return
        openedConversationIdsRef.current.add(conversationId)
        setActiveConversationId(conversationId)
        setMobileView("chat")
    }, [])

    const isVisibleForMe = React.useCallback(
        (m: UiMessage): boolean => {
            // Referral user module must ONLY show counselor conversations:
            // - outgoing: me(referral_user) -> counselor
            // - incoming: counselor -> me(referral_user)
            if (m.sender === "referral_user") {
                return String(m.senderId ?? "") === myUserId && m.recipientRole === "counselor"
            }
            if (m.sender === "counselor") {
                return m.recipientRole === "referral_user" && String(m.recipientId ?? "") === myUserId
            }
            // system messages (client-only seed) are allowed
            return m.sender === "system"
        },
        [myUserId],
    )

    const loadMessages = async (mode: "initial" | "refresh" = "refresh") => {
        const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing
        setBusy(true)

        try {
            const raw = await tryFetchReferralUserMessages(token)
            const uiAll = (Array.isArray(raw) ? raw : []).map(mapDtoToUi)
            const ui = uiAll.filter(isVisibleForMe)

            setMessages(ui)

            const convs = buildConversations(ui)

            // ✅ IMPORTANT (same behavior as counselor/messages.tsx):
            // Do NOT auto-open / auto-select the first thread on page load.
            // Only clear the active thread if it no longer exists.
            const current = activeConversationId
            const hasCurrent = !!current && convs.some((c) => c.id === current)

            if (current && !hasCurrent) {
                openedConversationIdsRef.current.delete(current)
                setActiveConversationId("")
                setMobileView("list")
            }
        } catch (err: any) {
            if (err?.status === 401) toast.error("Unauthorized (401). Please log in again, then retry.")
            else toast.error(err instanceof Error ? err.message : "Failed to load messages.")
        } finally {
            setBusy(false)
        }
    }

    React.useEffect(() => {
        loadMessages("initial")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRefresh = async () => {
        if (isLoading || isRefreshing) return
        await loadMessages("refresh")
    }

    const conversations = React.useMemo(() => buildConversations(messages), [messages])

    const filteredConversations = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return conversations
        return conversations.filter((c) => c.peerName.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q))
    }, [conversations, search])

    const activeConversation = React.useMemo(
        () => conversations.find((c) => c.id === activeConversationId) ?? null,
        [conversations, activeConversationId],
    )

    const activeMessages = React.useMemo(() => {
        if (!activeConversationId) return []
        return messages
            .filter((m) => m.conversationId === activeConversationId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }, [messages, activeConversationId])

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [activeConversationId, activeMessages.length])

    React.useEffect(() => {
        if (!showNewMessage) return

        const q = recipientQuery.trim()
        const shouldFetch = q.length === 0 || q.length >= 2

        if (!shouldFetch) {
            setRecipientResults([])
            setRecipientLoading(false)
            return
        }

        let cancelled = false

        const t = window.setTimeout(async () => {
            setRecipientLoading(true)
            try {
                const users = await trySearchCounselorsFromDb(q, token)
                if (cancelled) return
                setRecipientResults(users)
            } catch (err) {
                if (cancelled) return
                setRecipientResults([])
                toast.error(err instanceof Error ? err.message : "Failed to search counselors.")
            } finally {
                if (!cancelled) setRecipientLoading(false)
            }
        }, q.length === 0 ? 0 : 300)

        return () => {
            cancelled = true
            window.clearTimeout(t)
        }
    }, [recipientQuery, showNewMessage, token])

    const startNewConversation = () => {
        if (!newRecipient) {
            toast.error("Counselor is required.")
            return
        }

        const peerId = newRecipient.id
        const peerName = newRecipient.name

        const conversationId = `new-counselor-${String(peerId)}-${Date.now()}`
        const nowIso = new Date().toISOString()

        const seed: UiMessage = {
            id: `seed-${conversationId}`,
            conversationId,
            sender: "system",
            senderName: "System",
            content: `Conversation started with ${peerName}.`,
            createdAt: nowIso,
            isUnread: false,

            recipientRole: "counselor",
            recipientId: peerId,
            recipientName: peerName,
            recipientAvatarUrl: newRecipient.avatar_url ?? null,
        }

        setMessages((prev) => [...prev, seed])

        // ✅ Starting a conversation counts as "opened"
        openConversation(conversationId)

        setShowNewMessage(false)
        setNewRecipient(null)
        setRecipientQuery("")
        setRecipientResults([])
    }

    const markConversationReadById = React.useCallback(
        async (conversationId: string, opts?: { silent?: boolean }) => {
            if (!conversationId) return
            if (markInflightRef.current.has(conversationId)) return

            const unread = messages.filter((m) => m.conversationId === conversationId && m.isUnread)
            if (unread.length === 0) return

            const unreadIdSet = new Set(unread.map((m) => String(m.id)))

            const numericIdsRaw = unread
                .map((m) => normalizeIdToNumberOrNull(m.id))
                .filter((n): n is number => typeof n === "number" && Number.isFinite(n))

            const numericIds = Array.from(new Set(numericIdsRaw))

            markInflightRef.current.add(conversationId)

            // optimistic UI: clear unread locally
            setMessages((prev) =>
                prev.map((m) =>
                    m.conversationId === conversationId && unreadIdSet.has(String(m.id))
                        ? { ...m, isUnread: false }
                        : m,
                ),
            )

            try {
                if (numericIds.length > 0) {
                    await tryMarkMessagesAsRead(numericIds, token)
                }
            } catch (err: any) {
                // rollback optimistic update if server fails
                setMessages((prev) =>
                    prev.map((m) =>
                        m.conversationId === conversationId && unreadIdSet.has(String(m.id))
                            ? { ...m, isUnread: true }
                            : m,
                    ),
                )

                if (!opts?.silent) {
                    if (err?.status === 401) toast.error("Unauthorized (401). Please log in again.")
                    else toast.error(err instanceof Error ? err.message : "Failed to mark messages as read.")
                }
            } finally {
                markInflightRef.current.delete(conversationId)
            }
        },
        [messages, token],
    )

    /**
     * ✅ REQUIRED BEHAVIOR:
     * - Do NOT mark read unless the user OPENED the thread OR sent a reply.
     * - Once opened, auto-mark as read (no manual action needed).
     */
    React.useEffect(() => {
        if (!activeConversationId) return
        if (!openedConversationIdsRef.current.has(activeConversationId)) return
        void markConversationReadById(activeConversationId, { silent: true })
    }, [activeConversationId, activeMessages.length, markConversationReadById])

    const markConversationRead = async () => {
        if (!activeConversationId) return
        setIsMarking(true)
        try {
            await markConversationReadById(activeConversationId, { silent: false })
        } finally {
            setIsMarking(false)
        }
    }

    const askDeleteConversation = () => {
        if (!activeConversation) return
        setDeleteConvoOpen(true)
    }

    const confirmDeleteConversation = async () => {
        if (!activeConversation) return

        const convoId = activeConversation.id
        const removedMessages = activeMessages

        setIsDeletingConvo(true)

        setMessages((prev) => prev.filter((m) => m.conversationId !== convoId))

        try {
            await tryDeleteConversationApi(convoId, token)
            toast.success("Conversation deleted.")
            setDeleteConvoOpen(false)

            // ✅ Do NOT auto-open another thread after delete
            openedConversationIdsRef.current.delete(convoId)
            setActiveConversationId("")
            setMobileView("list")
        } catch (err) {
            setMessages((prev) => [...prev, ...removedMessages])
            toast.error(err instanceof Error ? err.message : "Failed to delete conversation.")
        } finally {
            setIsDeletingConvo(false)
        }
    }

    const getConversationAvatarSrc = (c: Conversation): string | null => {
        return resolveAvatarSrc(c.peerAvatarUrl ?? null)
    }

    const beginEditMessage = (m: UiMessage) => {
        setEditingMessageId(String(m.id))
        setEditDraft(m.content ?? "")
    }

    const cancelEditMessage = () => {
        setEditingMessageId("")
        setEditDraft("")
        setIsUpdatingMessage(false)
    }

    const saveEditMessage = async (m: UiMessage) => {
        const next = editDraft.trim()
        if (!next) {
            toast.error("Message cannot be empty.")
            return
        }

        const msgIdNum = normalizeIdToNumberOrNull(m.id)
        const prevContent = m.content

        setIsUpdatingMessage(true)
        setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, content: next } : x)))

        try {
            if (msgIdNum == null) {
                toast.success("Message updated.")
                cancelEditMessage()
                return
            }

            const res = await tryUpdateMessageApi(msgIdNum, next, token)

            const dto =
                (res as any)?.messageRecord ||
                (res as any)?.message ||
                (res as any)?.data ||
                (res as any)?.record ||
                null

            if (dto) {
                const serverMsg = mapDtoToUi(dto)
                setMessages((prev) =>
                    prev.map((x) =>
                        String(x.id) === String(m.id) ? { ...serverMsg, isUnread: false } : x,
                    ),
                )
            }

            toast.success("Message updated.")
            cancelEditMessage()
        } catch (err) {
            setMessages((prev) => prev.map((x) => (String(x.id) === String(m.id) ? { ...x, content: prevContent } : x)))
            toast.error(err instanceof Error ? err.message : "Failed to update message.")
            setIsUpdatingMessage(false)
        }
    }

    const askDeleteMessage = (m: UiMessage) => {
        setDeleteTarget(m)
        setDeleteMessageOpen(true)
    }

    const confirmDeleteMessage = async () => {
        if (!deleteTarget) return

        const target = deleteTarget
        const msgIdNum = normalizeIdToNumberOrNull(target.id)

        setIsDeletingMessage(true)

        setMessages((prev) => prev.filter((x) => String(x.id) !== String(target.id)))

        try {
            if (msgIdNum == null) {
                toast.success("Message deleted.")
                setDeleteMessageOpen(false)
                setDeleteTarget(null)
                return
            }

            await tryDeleteMessageApi(msgIdNum, token)
            toast.success("Message deleted.")
            setDeleteMessageOpen(false)
            setDeleteTarget(null)
        } catch (err) {
            setMessages((prev) => [...prev, target])
            toast.error(err instanceof Error ? err.message : "Failed to delete message.")
        } finally {
            setIsDeletingMessage(false)
        }
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!activeConversation) {
            toast.error("Select a conversation first.")
            return
        }

        // ✅ sending a reply counts as "opened"
        openedConversationIdsRef.current.add(activeConversation.id)

        const text = draft.trim()
        if (!text) return

        const counselorId = activeConversation.peerId ?? null
        if (!counselorId) {
            toast.error("Counselor is required.")
            return
        }

        setIsSending(true)

        const tempId = `local-${Date.now()}`
        const nowIso = new Date().toISOString()

        const optimistic: UiMessage = {
            id: tempId,
            conversationId: activeConversation.id,
            sender: "referral_user",
            senderName: myName,
            content: text,
            createdAt: nowIso,
            isUnread: false,
            senderId: myUserId || null,
            recipientRole: "counselor",
            recipientId: counselorId,
            recipientName: activeConversation.peerName,
            recipientAvatarUrl: activeConversation.peerAvatarUrl ?? null,
        }

        setMessages((prev) => [...prev, optimistic])
        setDraft("")

        try {
            const payload: any = {
                content: text,
                recipient_id: counselorId,
            }

            const res = await trySendReferralUserMessage(payload, token)

            const dto =
                (res as any)?.messageRecord ||
                (res as any)?.message ||
                (res as any)?.data ||
                null

            if (dto) {
                const serverMsg = mapDtoToUi(dto)

                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m)))

                // If server returns a different conversation id, migrate local thread ids (seed + optimistic)
                if (serverMsg.conversationId && serverMsg.conversationId !== activeConversation.id) {
                    const from = activeConversation.id
                    const to = serverMsg.conversationId

                    openedConversationIdsRef.current.add(to)

                    setMessages((prev) => prev.map((m) => (m.conversationId === from ? { ...m, conversationId: to } : m)))
                    setActiveConversationId(to)
                }
            }

            // ✅ Auto-mark-read after sending (silent)
            void markConversationReadById(activeConversation.id, { silent: true })
        } catch (err: any) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId))
            if (err?.status === 401) toast.error("Unauthorized (401). Please log in again.")
            else toast.error(err instanceof Error ? err.message : "Failed to send message.")
        } finally {
            setIsSending(false)
        }
    }

    return (
        <DashboardLayout title="Messages" description="Message counselors and manage your conversations.">
            <div className="mx-auto w-full px-4">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2 p-4 sm:p-6">
                        <CardTitle className="text-base">
                            <span className="sm:hidden">Inbox</span>
                            <span className="hidden sm:inline">Referral User Inbox</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            <span className="sm:hidden">Send messages to counselors.</span>
                            <span className="hidden sm:inline">
                                Start conversations with counselors and track replies.
                            </span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-160 grid-cols-1 md:grid-cols-[360px_1fr]">
                            {/* LEFT: conversations */}
                            <div className={`border-b md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
                                <div className="p-3 sm:p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-900">Inbox</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {myName}
                                            </div>
                                        </div>

                                        <Badge variant="secondary" className="w-fit text-[0.70rem]">
                                            Referral User
                                        </Badge>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 w-full text-[0.85rem] sm:text-xs"
                                        onClick={() => setShowNewMessage((v) => !v)}
                                    >
                                        {showNewMessage ? "Close new message" : "Create new message"}
                                    </Button>

                                    {showNewMessage ? (
                                        <div className="mt-3 rounded-xl border bg-white/60 p-3">
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[0.70rem] font-medium text-slate-700">
                                                        Counselor
                                                    </Label>

                                                    <UserCombobox
                                                        users={recipientResults}
                                                        value={newRecipient}
                                                        onChange={(u) => setNewRecipient(u)}
                                                        searchValue={recipientQuery}
                                                        onSearchValueChange={(v) => {
                                                            setRecipientQuery(v)
                                                            setNewRecipient(null)
                                                        }}
                                                        isLoading={recipientLoading}
                                                    />
                                                </div>

                                                <Button
                                                    type="button"
                                                    className="h-10 text-[0.85rem] sm:text-xs"
                                                    onClick={startNewConversation}
                                                    disabled={!newRecipient}
                                                >
                                                    Start
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <Tabs value="all" onValueChange={() => null}>
                                        <TabsList className="mt-3 flex w-full justify-start gap-1 overflow-x-auto whitespace-nowrap px-1 sm:grid sm:grid-cols-1 sm:px-0">
                                            <TabsTrigger value="all" className="min-w-20 text-[0.70rem] sm:text-xs">
                                                Counselors
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="mt-3">
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search conversations…"
                                            className="h-10 sm:h-9"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <ScrollArea className="h-128">
                                    <div className="space-y-2 p-3 sm:p-4">
                                        {isLoading ? (
                                            <div className="text-sm text-muted-foreground">Loading conversations…</div>
                                        ) : filteredConversations.length === 0 ? (
                                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">
                                                No conversations found.
                                            </div>
                                        ) : (
                                            filteredConversations.map((c) => {
                                                const active = c.id === activeConversationId
                                                const avatarSrc = getConversationAvatarSrc(c)

                                                return (
                                                    <Button
                                                        key={c.id}
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => openConversation(c.id)}
                                                        className={cn(
                                                            "h-auto w-full justify-start rounded-xl border p-0 text-left",
                                                            active ? "bg-white shadow-sm hover:bg-white" : "bg-white/60 hover:bg-white",
                                                        )}
                                                    >
                                                        <div className="w-full p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <Avatar className="h-9 w-9 border">
                                                                        <AvatarImage
                                                                            src={avatarSrc ?? undefined}
                                                                            alt={c.peerName}
                                                                            className="object-cover"
                                                                            loading="lazy"
                                                                        />
                                                                        <AvatarFallback className="text-xs font-semibold">
                                                                            {initials(c.peerName)}
                                                                        </AvatarFallback>
                                                                    </Avatar>

                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm font-semibold text-slate-900">
                                                                            {c.peerName}
                                                                        </div>
                                                                        <div className="truncate text-xs text-muted-foreground">
                                                                            {c.subtitle}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {c.unreadCount > 0 ? (
                                                                        <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">
                                                                            {c.unreadCount}
                                                                        </Badge>
                                                                    ) : null}
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatShort(c.lastTimestamp)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                                                {c.lastMessage || "No messages yet."}
                                                            </div>
                                                        </div>
                                                    </Button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* RIGHT: chat */}
                            <div className={`flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
                                <div className="flex flex-col gap-3 border-b bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="md:hidden"
                                            onClick={() => setMobileView("list")}
                                            aria-label="Back"
                                        >
                                            ←
                                        </Button>

                                        {activeConversation ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border">
                                                    <AvatarImage
                                                        src={getConversationAvatarSrc(activeConversation) ?? undefined}
                                                        alt={activeConversation.peerName}
                                                        className="object-cover"
                                                        loading="lazy"
                                                    />
                                                    <AvatarFallback className="text-xs font-semibold">
                                                        {initials(activeConversation.peerName)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">
                                                        {activeConversation.peerName}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        Counselor • {activeConversation.subtitle}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">Select a conversation</div>
                                        )}
                                    </div>

                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 sm:h-9 sm:w-9"
                                                onClick={handleRefresh}
                                                aria-label="Refresh"
                                                disabled={isLoading || isRefreshing}
                                            >
                                                <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 sm:h-9 sm:w-9"
                                                        disabled={!activeConversation}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onSelect={(e) => {
                                                            e.preventDefault()
                                                            askDeleteConversation()
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete conversation
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 w-full sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
                                            onClick={markConversationRead}
                                            disabled={!activeConversation || isMarking}
                                        >
                                            {isMarking ? "Marking…" : "Mark read"}
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="h-120 bg-linear-to-b from-muted/30 to-white sm:h-128">
                                    <div className="space-y-3 p-3 sm:p-4">
                                        {!activeConversation ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">
                                                Choose a conversation from the left.
                                            </div>
                                        ) : isLoading ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">
                                                Loading messages…
                                            </div>
                                        ) : activeMessages.length === 0 ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">
                                                No messages yet.
                                            </div>
                                        ) : (
                                            activeMessages.map((m) => {
                                                const mine =
                                                    (m.sender === "student" || m.sender === "guest" || m.sender === "referral_user") &&
                                                    (String(m.senderId ?? "") === myUserId || String(m.userId ?? "") === myUserId)

                                                const system = m.sender === "system"
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start"

                                                const bubble = system
                                                    ? "border bg-white/90"
                                                    : mine
                                                        ? "border-indigo-200 bg-indigo-50/90"
                                                        : "border-slate-200 bg-white/90"

                                                const isEditing = String(m.id) === editingMessageId

                                                return (
                                                    <div key={String(m.id)} className={`flex ${align}`}>
                                                        <div className="max-w-[92%] sm:max-w-[86%]">
                                                            <div
                                                                className={cn(
                                                                    "mb-1 flex flex-wrap items-center gap-2 text-[0.70rem] text-muted-foreground",
                                                                    system ? "justify-center" : mine ? "justify-end" : "justify-start",
                                                                )}
                                                            >
                                                                {system ? null : (
                                                                    <span className="font-medium text-slate-700">
                                                                        {mine ? "You" : m.senderName}
                                                                    </span>
                                                                )}
                                                                <span aria-hidden="true">•</span>
                                                                <span>{formatTimestamp(m.createdAt)}</span>

                                                                {!system && mine ? (
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6 rounded-full"
                                                                                aria-label="Message actions"
                                                                                disabled={isUpdatingMessage || isDeletingMessage}
                                                                            >
                                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem
                                                                                onSelect={(e) => {
                                                                                    e.preventDefault()
                                                                                    beginEditMessage(m)
                                                                                }}
                                                                                disabled={isEditing || isUpdatingMessage}
                                                                            >
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onSelect={(e) => {
                                                                                    e.preventDefault()
                                                                                    askDeleteMessage(m)
                                                                                }}
                                                                                disabled={isDeletingMessage}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                ) : null}
                                                            </div>

                                                            <div className={cn("rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm", bubble)}>
                                                                {isEditing ? (
                                                                    <div className="space-y-2">
                                                                        <Textarea
                                                                            value={editDraft}
                                                                            onChange={(e) => setEditDraft(e.target.value)}
                                                                            className="min-h-20 resize-none rounded-xl"
                                                                            disabled={isUpdatingMessage}
                                                                        />
                                                                        <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className="h-9"
                                                                                onClick={cancelEditMessage}
                                                                                disabled={isUpdatingMessage}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                className="h-9"
                                                                                onClick={() => saveEditMessage(m)}
                                                                                disabled={isUpdatingMessage || !editDraft.trim()}
                                                                            >
                                                                                {isUpdatingMessage ? "Saving…" : "Save"}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    m.content
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}

                                        <div ref={bottomRef} />
                                    </div>
                                </ScrollArea>

                                <form onSubmit={handleSend} className="border-t bg-white/80 p-3 sm:p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                                        <div className="flex-1">
                                            <Textarea
                                                value={draft}
                                                onChange={(e) => setDraft(e.target.value)}
                                                placeholder={activeConversation ? `Message ${activeConversation.peerName}…` : "Select a conversation…"}
                                                disabled={!activeConversation || isSending}
                                                className="min-h-12 resize-none rounded-2xl"
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="h-11 w-full rounded-2xl px-5 sm:w-auto"
                                            disabled={!activeConversation || isSending || !draft.trim()}
                                        >
                                            {isSending ? "Sending…" : "Send"}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <AlertDialog open={deleteConvoOpen} onOpenChange={(v) => (!isDeletingConvo ? setDeleteConvoOpen(v) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will remove the entire thread (all messages) from your inbox.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingConvo}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteConversation}
                                disabled={isDeletingConvo}
                                className="bg-destructive text-white hover:bg-destructive/90"
                            >
                                {isDeletingConvo ? "Deleting…" : "Delete conversation"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog
                    open={deleteMessageOpen}
                    onOpenChange={(v) => (!isDeletingMessage ? setDeleteMessageOpen(v) : null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete message?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will delete the selected message. This action can’t be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingMessage}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteMessage}
                                disabled={isDeletingMessage}
                                className="bg-destructive text-white hover:bg-destructive/90"
                            >
                                {isDeletingMessage ? "Deleting…" : "Delete message"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}

export default ReferralUserMessages
