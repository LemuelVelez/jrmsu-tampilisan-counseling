/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import DashboardLayout from "@/components/DashboardLayout"
import { toast } from "sonner"
import { format } from "date-fns"

import { getCurrentSession } from "@/lib/authentication"
import {
    fetchAdminMessageConversations,
    fetchAdminConversationMessages,
    deleteAdminConversation,
    updateAdminMessage,
    deleteAdminMessage,
    sendAdminMessage,
    type AdminMessage,
    type AdminConversationSummary,
} from "@/lib/messages"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react"

type PeerRole = "student" | "guest" | "counselor" | "admin" | "referral_user"
type SenderRole = PeerRole | "system"

type UiMessage = {
    id: number | string
    conversationId: string
    sender: SenderRole
    senderName: string
    content: string
    createdAt: string
    isUnread: boolean

    senderId?: number | string | null
    recipientId?: number | string | null
    recipientRole?: PeerRole | null

    recipientName?: string | null
    userName?: string | null

    senderAvatarUrl?: string | null
    recipientAvatarUrl?: string | null
}

type Conversation = {
    id: string
    peerRole: PeerRole
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
    role: PeerRole
    role_name?: string | null
    avatar_url?: string | null
}

type AutoStartConversationPayload = {
    role: PeerRole
    id: number | string
    name?: string
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

/**
 * Avatar resolver compatible with common Laravel storage formats.
 * Keeps absolute URLs, normalizes wrong /api/storage -> /storage.
 */
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
        normalized.toLowerCase().startsWith("storage/") || normalized.toLowerCase().startsWith("api/storage/")

    let path = normalized
    if (!alreadyStorage && looksLikeFilePath(normalized)) {
        path = `storage/${normalized}`
    }

    path = path.replace(/^api\/storage\//i, "storage/")

    const finalPath = path.startsWith("/") ? path : `/${path}`
    const origin = getApiOrigin()
    return origin ? `${origin}${finalPath}` : finalPath
}

function normalizeRawRoleString(raw: any): string {
    if (raw == null) return ""
    return String(raw).trim()
}

function referralRoleName(rawRole?: any): string | null {
    const r = normalizeRawRoleString(rawRole).toLowerCase()
    if (!r) return null
    if (r === "dean") return "Dean"
    if (r === "registrar") return "Registrar"
    if (r === "program_chair" || r === "program chair" || r === "programchair") return "Program Chair"
    if (r.includes("dean")) return "Dean"
    if (r.includes("registrar")) return "Registrar"
    if (r.includes("program") && r.includes("chair")) return "Program Chair"
    return null
}

/**
 * Map backend role-ish strings to PeerRole.
 * Includes referral office roles -> referral_user.
 */
function toPeerRole(role: any): PeerRole | null {
    if (role == null) return null
    const r0 = String(role).trim()
    const r = r0.toLowerCase()

    if (r === "student") return "student"
    if (r === "guest") return "guest"
    if (r === "counselor") return "counselor"
    if (r === "admin") return "admin"

    if (r === "referral_user" || r === "referral user" || r === "referral-user" || r === "referralusers") return "referral_user"
    if (r === "dean" || r === "registrar" || r === "program_chair" || r === "program chair" || r === "programchair") return "referral_user"

    if (r === "guidance" || r === "guidance_counselor" || r === "guidance counselor") return "counselor"
    if (r === "administrator" || r === "superadmin" || r === "super_admin") return "admin"

    if (r === "students") return "student"
    if (r === "guests") return "guest"
    if (r === "counselors") return "counselor"
    if (r === "admins") return "admin"
    if (r === "referral_users" || r === "referral-users") return "referral_user"

    return null
}

function roleLabel(r: PeerRole) {
    if (r === "counselor") return "Counselor"
    if (r === "guest") return "Guest"
    if (r === "admin") return "Admin"
    if (r === "referral_user") return "Referral User"
    return "Student"
}

function roleThreadLabel(r: PeerRole): string {
    if (r === "counselor") return "Counselor thread"
    if (r === "guest") return "Guest thread"
    if (r === "admin") return "Admin thread"
    if (r === "referral_user") return "Referral user thread"
    return "Student thread"
}

function normalizeSender(sender: any): SenderRole {
    const s = String(sender ?? "").trim().toLowerCase()
    if (s === "system") return "system"
    const pr = toPeerRole(sender)
    return pr ?? "system"
}

function extractUserName(u: any): string {
    const name =
        (u?.name && String(u.name).trim()) ||
        (u?.full_name && String(u.full_name).trim()) ||
        (u?.fullname && String(u.fullname).trim()) ||
        (u?.display_name && String(u.display_name).trim()) ||
        (u?.first_name || u?.last_name ? `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() : "") ||
        ""
    return name || "Unknown"
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    const candidates = [payload.users, payload.data, payload.results, payload.items, payload.records, payload?.payload?.users, payload?.payload?.data]
    for (const c of candidates) if (Array.isArray(c)) return c
    return []
}

async function apiFetch(path: string, init: RequestInit, token?: string | null): Promise<unknown> {
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
        throw new Error(msg)
    }

    return data
}

/**
 * ✅ Admin can message any user:
 * We search the DB directory endpoints by role + query (same approach as counselor page).
 */
async function trySearchUsersFromDb(role: PeerRole, query: string, token?: string | null): Promise<DirectoryUser[]> {
    const q = query.trim()
    const roleParam = encodeURIComponent(role)

    const candidates: string[] = []

    const pushRoleCandidates = (basePlural: string, qq?: string) => {
        if (qq) {
            candidates.push(`/${basePlural}?search=${qq}`)
            candidates.push(`/${basePlural}/search?q=${qq}`)
            candidates.push(`/${basePlural}?query=${qq}`)
            candidates.push(`/${basePlural}?q=${qq}`)
        } else {
            candidates.push(`/${basePlural}?limit=20`)
            candidates.push(`/${basePlural}?per_page=20`)
        }
    }

    if (q.length > 0) {
        const qq = encodeURIComponent(q)

        if (role === "referral_user") {
            pushRoleCandidates("referral_users", qq)
            pushRoleCandidates("referral-users", qq)
        } else {
            pushRoleCandidates(`${role}s`, qq)
        }

        candidates.push(`/users?role=${roleParam}&search=${qq}`)
        candidates.push(`/users?role=${roleParam}&q=${qq}`)
        candidates.push(`/users/search?role=${roleParam}&q=${qq}`)
        candidates.push(`/search/users?role=${roleParam}&q=${qq}`)
    } else {
        if (role === "referral_user") {
            pushRoleCandidates("referral_users")
            pushRoleCandidates("referral-users")
        } else {
            pushRoleCandidates(`${role}s`)
        }
        candidates.push(`/users?role=${roleParam}&limit=20`)
        candidates.push(`/users?role=${roleParam}&per_page=20`)
    }

    let lastErr: any = null

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET" }, token)
            const arr = extractUsersArray(data)
            if (!Array.isArray(arr)) continue

            const mapped: DirectoryUser[] = arr
                .map((raw: any) => {
                    const u = raw?.user ?? raw

                    const id = u?.id ?? u?.user_id ?? u?.account_id ?? u?.student_id ?? u?.counselor_id
                    if (id == null || String(id).trim() === "") return null

                    const name = extractUserName(u)

                    const rawRole = u?.role ?? u?.role_name ?? u?.type ?? raw?.role ?? raw?.role_name ?? raw?.type ?? null
                    const dbRole = toPeerRole(rawRole)
                    if (!dbRole) return null
                    if (dbRole !== role) return null

                    const avatarRaw = u?.avatar_url ?? raw?.avatar_url ?? raw?.avatar ?? null

                    const officeRoleRaw =
                        u?.office_role ??
                        u?.designation ??
                        (dbRole === "referral_user" ? u?.role_name : null) ??
                        raw?.office_role ??
                        raw?.designation ??
                        (dbRole === "referral_user" ? raw?.role_name : null) ??
                        null

                    const referralSpecific = dbRole === "referral_user" ? (referralRoleName(officeRoleRaw ?? rawRole) ?? null) : null

                    return {
                        id,
                        name,
                        role: dbRole,
                        role_name: referralSpecific,
                        avatar_url: avatarRaw,
                    } as DirectoryUser
                })
                .filter(Boolean) as DirectoryUser[]

            const seen = new Set<string>()
            const deduped = mapped.filter((u) => {
                const key = `${u.role}-${String(u.id)}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })

            return deduped
        } catch (e) {
            lastErr = e
        }
    }

    throw lastErr ?? new Error("Failed to search users from database.")
}

function UserCombobox(props: {
    users: DirectoryUser[]
    value: DirectoryUser | null
    onChange: (u: DirectoryUser) => void
    searchValue: string
    onSearchValueChange: (v: string) => void
    isLoading?: boolean
    placeholder?: string
    emptyText?: string
}) {
    const {
        users,
        value,
        onChange,
        searchValue,
        onSearchValueChange,
        isLoading,
        placeholder = "Select user…",
        emptyText = "No users found.",
    } = props

    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 w-full justify-between sm:h-9"
                    type="button"
                >
                    <span className={cn("min-w-0 truncate text-left", !value ? "text-muted-foreground" : "")}>
                        {value ? `${value.name} • ID: ${value.id}` : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Type name or ID…"
                        value={searchValue}
                        onValueChange={(v) => onSearchValueChange(v)}
                    />
                    <CommandList>
                        <CommandEmpty>{isLoading ? "Searching…" : emptyText}</CommandEmpty>
                        <CommandGroup>
                            {users.map((u) => {
                                const selected = !!value && value.role === u.role && String(value.id) === String(u.id)
                                const referralLabel =
                                    u.role === "referral_user" ? (u.role_name ? u.role_name : roleLabel(u.role)) : roleLabel(u.role)

                                return (
                                    <CommandItem
                                        key={`${u.role}-${u.id}`}
                                        value={`${u.name} ${u.id}`}
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
                                                {referralLabel} • ID: {u.id}
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

const formatTimestamp = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, "MMM d, yyyy • h:mm a")
}

const formatTimeOnly = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return format(d, "h:mm a")
}

const formatShort = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "MMM d")
}

const initials = (name: string) => {
    const cleaned = (name || "").trim()
    if (!cleaned) return "AD"
    const parts = cleaned.split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "AD"
}

function parseConversationId(conversationId: string): { role: PeerRole | null; id: string | null } {
    const s = String(conversationId || "").trim()
    if (!s) return { role: null, id: null }

    const m = s.match(/^(student|guest|admin|referral_user)-(\d+)$/i)
    if (m) return { role: toPeerRole(m[1]) as PeerRole, id: m[2] }

    const m2 = s.match(/^(counselor)-(\d+)$/i)
    if (m2) return { role: "counselor", id: m2[2] }

    // counselor-1-2 or counselor-office etc: show counselor thread
    if (s.toLowerCase().startsWith("counselor-")) return { role: "counselor", id: null }

    return { role: null, id: null }
}

function mapAdminMessageToUi(dto: AdminMessage, conversationFallback: string): UiMessage {
    const sender = normalizeSender((dto as any).sender_role ?? (dto as any).sender ?? "system")

    const senderName =
        (dto as any).sender_name ||
        (sender === "system"
            ? "System"
            : sender === "admin"
                ? "Admin"
                : sender === "counselor"
                    ? "Counselor"
                    : sender === "guest"
                        ? "Guest"
                        : sender === "referral_user"
                            ? "Referral User"
                            : "Student")

    const createdAt = (dto as any).created_at ?? new Date(0).toISOString()
    const conversationId = String((dto as any).conversation_id ?? conversationFallback)

    const recipientRole = toPeerRole((dto as any).recipient_role) ?? null

    // read flag not critical for admin view; keep false unless backend gives it
    const isUnread = (dto as any).is_read === false || (dto as any).is_read === 0

    const senderAvatarUrl =
        (dto as any).sender_avatar_url ??
        (dto as any).owner_avatar_url ??
        null

    const recipientAvatarUrl =
        (dto as any).recipient_avatar_url ??
        null

    return {
        id: (dto as any).id ?? `${createdAt}-${sender}-${Math.random().toString(36).slice(2)}`,
        conversationId,
        sender,
        senderName: String(senderName || "").trim() || "Unknown",
        content: (dto as any).content ?? "",
        createdAt,
        isUnread,

        senderId: (dto as any).sender_id ?? null,
        recipientId: (dto as any).recipient_id ?? null,
        recipientRole,

        recipientName: (dto as any).recipient_name ?? null,
        userName: (dto as any).owner_name ?? null,

        senderAvatarUrl,
        recipientAvatarUrl,
    }
}

function mapAdminConversationToUi(c: AdminConversationSummary): Conversation {
    const conversationId = String((c as any).conversation_id ?? "")
    const last = (c as any).last_message as AdminMessage | undefined

    const parsed = parseConversationId(conversationId)
    const peerRoleFromId = parsed.role
    const peerIdFromId = parsed.id

    const ownerRole = toPeerRole((last as any)?.owner_role ?? null)
    const ownerId = (last as any)?.owner_user_id ?? null

    const peerRole = (peerRoleFromId ?? ownerRole ?? toPeerRole((last as any)?.recipient_role) ?? toPeerRole((last as any)?.sender_role) ?? "student") as PeerRole
    const peerId =
        peerIdFromId != null
            ? peerIdFromId
            : ownerId != null
                ? ownerId
                : (last as any)?.recipient_id ?? null

    const peerName =
        (typeof (last as any)?.owner_name === "string" && (last as any).owner_name.trim() && ownerId != null ? (last as any).owner_name : "") ||
        (typeof (last as any)?.recipient_name === "string" && (last as any).recipient_name.trim() ? (last as any).recipient_name : "") ||
        (typeof (last as any)?.sender_name === "string" && (last as any).sender_name.trim() ? (last as any).sender_name : "") ||
        roleLabel(peerRole)

    const peerAvatarUrl =
        (last as any)?.owner_avatar_url ??
        (last as any)?.recipient_avatar_url ??
        (last as any)?.sender_avatar_url ??
        null

    return {
        id: conversationId,
        peerRole,
        peerName,
        peerId,
        subtitle: roleThreadLabel(peerRole),
        unreadCount: 0,
        lastMessage: (last as any)?.content ?? "",
        lastTimestamp: (last as any)?.created_at ?? "",
        peerAvatarUrl,
    }
}

const AdminMessages: React.FC = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const session = getCurrentSession()
    const token = (session as any)?.token ?? null
    const adminName = session?.user && (session.user as any).name ? String((session.user as any).name) : "Admin"
    const myUserId = session?.user?.id != null ? String(session.user.id) : ""

    const [isLoading, setIsLoading] = React.useState(true)
    const [isRefreshing, setIsRefreshing] = React.useState(false)
    const [isSending, setIsSending] = React.useState(false)

    const [roleFilter, setRoleFilter] = React.useState<"all" | PeerRole>("all")
    const [search, setSearch] = React.useState("")
    const [mobileView, setMobileView] = React.useState<"list" | "chat">("list")

    const [draft, setDraft] = React.useState("")

    const [conversations, setConversations] = React.useState<Conversation[]>([])
    const [draftConversations, setDraftConversations] = React.useState<Conversation[]>([])
    const [activeConversationId, setActiveConversationId] = React.useState<string>("")

    const [messagesByConversation, setMessagesByConversation] = React.useState<Record<string, UiMessage[]>>({})
    const bottomRef = React.useRef<HTMLDivElement | null>(null)
    const localIdRef = React.useRef(0)

    // ✅ Extracted dependency value so exhaustive-deps can statically check it
    const activeMessageCount = React.useMemo(() => {
        if (!activeConversationId) return 0
        return messagesByConversation[activeConversationId]?.length ?? 0
    }, [activeConversationId, messagesByConversation])

    // New message UI
    const [showNewMessage, setShowNewMessage] = React.useState(false)
    const [newRole, setNewRole] = React.useState<PeerRole>("student")
    const [newRecipient, setNewRecipient] = React.useState<DirectoryUser | null>(null)
    const [recipientQuery, setRecipientQuery] = React.useState("")
    const [recipientResults, setRecipientResults] = React.useState<DirectoryUser[]>([])
    const [recipientLoading, setRecipientLoading] = React.useState(false)

    // Edit dialog
    const [editOpen, setEditOpen] = React.useState(false)
    const [editingMessage, setEditingMessage] = React.useState<UiMessage | null>(null)
    const [editDraft, setEditDraft] = React.useState("")
    const [isSavingEdit, setIsSavingEdit] = React.useState(false)

    // Delete message confirm
    const [deleteMsgOpen, setDeleteMsgOpen] = React.useState(false)
    const [deletingMessage, setDeletingMessage] = React.useState<UiMessage | null>(null)
    const [isDeletingMsg, setIsDeletingMsg] = React.useState(false)

    // Delete conversation confirm
    const [deleteConvoOpen, setDeleteConvoOpen] = React.useState(false)
    const [isDeletingConvo, setIsDeletingConvo] = React.useState(false)

    // Auto-start conversation (optional)
    const autoStartRef = React.useRef<AutoStartConversationPayload | null>(null)
    React.useEffect(() => {
        const payload = (location.state as any)?.autoStartConversation as AutoStartConversationPayload | undefined
        if (!payload) return
        if (!payload.role || !toPeerRole(payload.role)) return
        autoStartRef.current = payload
    }, [location.state])

    const loadConversations = React.useCallback(
        async (mode: "initial" | "refresh" = "refresh") => {
            const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing
            setBusy(true)
            try {
                const res = await fetchAdminMessageConversations({
                    page: 1,
                    per_page: 100,
                    search: search.trim() ? search.trim() : undefined,
                })
                const raw = Array.isArray((res as any).conversations) ? (res as any).conversations : []
                const mapped: Conversation[] = raw.map((c: any) => mapAdminConversationToUi(c as AdminConversationSummary))

                setConversations(mapped)

                const current = activeConversationId
                const mergedIds = new Set<string>(mapped.map((x: Conversation) => x.id))
                for (const d of draftConversations) mergedIds.add(d.id)

                if (!current) {
                    if (mapped.length > 0) setActiveConversationId(mapped[0].id)
                    else if (draftConversations.length > 0) setActiveConversationId(draftConversations[0].id)
                } else if (!mergedIds.has(current)) {
                    if (mapped.length > 0) setActiveConversationId(mapped[0].id)
                    else if (draftConversations.length > 0) setActiveConversationId(draftConversations[0].id)
                    else setActiveConversationId("")
                }
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to load admin conversations.")
            } finally {
                setBusy(false)
            }
        },
        [activeConversationId, draftConversations, search],
    )

    const loadConversationMessages = React.useCallback(
        async (conversationId: string) => {
            if (!conversationId) return
            // draft conversation: local only
            if (conversationId.startsWith("new-")) {
                setMessagesByConversation((prev) => ({ ...prev, [conversationId]: prev[conversationId] ?? [] }))
                return
            }

            try {
                const res = await fetchAdminConversationMessages(conversationId, { page: 1, per_page: 500 })
                const raw = Array.isArray((res as any).messages) ? (res as any).messages : []

                const ui: UiMessage[] = raw.map((m: any) => mapAdminMessageToUi(m as AdminMessage, conversationId))
                ui.sort((a: UiMessage, b: UiMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

                setMessagesByConversation((prev) => ({ ...prev, [conversationId]: ui }))
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to load conversation messages.")
            }
        },
        [],
    )

    React.useEffect(() => {
        let mounted = true
            ; (async () => {
                if (!mounted) return
                await loadConversations("initial")
            })()
        return () => {
            mounted = false
        }
    }, [loadConversations])

    React.useEffect(() => {
        if (!activeConversationId) return
        loadConversationMessages(activeConversationId)
    }, [activeConversationId, loadConversationMessages])

    // ✅ No complex expression in dependency array anymore
    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [activeConversationId, activeMessageCount])

    // Debounced DB user search for new message
    React.useEffect(() => {
        if (!showNewMessage) return

        let cancelled = false
        const q = recipientQuery.trim()
        const shouldFetch = q.length === 0 || q.length >= 2

        if (!shouldFetch) {
            setRecipientResults([])
            setRecipientLoading(false)
            return
        }

        const t = window.setTimeout(async () => {
            setRecipientLoading(true)
            try {
                const users = await trySearchUsersFromDb(newRole, q, token)
                if (cancelled) return
                setRecipientResults(users)
            } catch (err) {
                if (cancelled) return
                setRecipientResults([])
                toast.error(err instanceof Error ? err.message : "Failed to search users.")
            } finally {
                if (!cancelled) setRecipientLoading(false)
            }
        }, q.length === 0 ? 0 : 300)

        return () => {
            cancelled = true
            window.clearTimeout(t)
        }
    }, [recipientQuery, newRole, showNewMessage, token])

    // Merge server + drafts
    const mergedConversations = React.useMemo(() => {
        const map = new Map<string, Conversation>()
        for (const c of conversations) map.set(c.id, c)
        for (const d of draftConversations) if (!map.has(d.id)) map.set(d.id, d)
        const out: Conversation[] = Array.from(map.values())

        out.sort((a: Conversation, b: Conversation) => {
            const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0
            const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0
            return tb - ta
        })

        return out
    }, [conversations, draftConversations])

    // Auto-start once conversations exist
    React.useEffect(() => {
        const payload = autoStartRef.current
        if (!payload) return
        if (isLoading) return

        const targetRole = payload.role
        const targetId = String(payload.id)

        const existing =
            mergedConversations.find((c) => c.peerRole === targetRole && String(c.peerId ?? "") === targetId) ?? null

        if (existing) {
            setActiveConversationId(existing.id)
            setMobileView("chat")
        } else {
            const nowIso = new Date().toISOString()
            const conversationId = `new-${targetRole}-${targetId}-${Date.now()}`

            const convo: Conversation = {
                id: conversationId,
                peerRole: targetRole,
                peerName: payload.name ?? roleLabel(targetRole),
                peerId: payload.id,
                subtitle: roleThreadLabel(targetRole),
                unreadCount: 0,
                lastMessage: "",
                lastTimestamp: nowIso,
                peerAvatarUrl: null,
            }

            setDraftConversations((prev) => [convo, ...prev])
            setActiveConversationId(conversationId)
            setMobileView("chat")
        }

        setShowNewMessage(false)
        autoStartRef.current = null
        navigate("/dashboard/admin/message", { replace: true, state: {} })
    }, [mergedConversations, isLoading, navigate])

    const filteredConversations = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        return mergedConversations
            .filter((c) => (roleFilter === "all" ? true : c.peerRole === roleFilter))
            .filter((c) => {
                if (!q) return true
                return (
                    String(c.peerName || "").toLowerCase().includes(q) ||
                    String(c.subtitle || "").toLowerCase().includes(q) ||
                    roleLabel(c.peerRole).toLowerCase().includes(q)
                )
            })
    }, [mergedConversations, roleFilter, search])

    const activeConversation = React.useMemo(
        () => mergedConversations.find((c) => c.id === activeConversationId) ?? null,
        [mergedConversations, activeConversationId],
    )

    const activeMessages = React.useMemo(() => {
        if (!activeConversationId) return []
        return messagesByConversation[activeConversationId] ?? []
    }, [messagesByConversation, activeConversationId])

    const handleRefresh = async () => {
        if (isLoading || isRefreshing) return
        await loadConversations("refresh")
        if (activeConversationId) await loadConversationMessages(activeConversationId)
    }

    const startNewConversation = () => {
        if (!newRecipient) {
            toast.error("Recipient is required.")
            return
        }

        const peerId = newRecipient.id
        const peerName = newRecipient.name
        const conversationId = `new-${newRecipient.role}-${String(peerId)}-${Date.now()}`
        const nowIso = new Date().toISOString()

        const convo: Conversation = {
            id: conversationId,
            peerRole: newRecipient.role,
            peerName,
            peerId,
            subtitle: roleThreadLabel(newRecipient.role),
            unreadCount: 0,
            lastMessage: "",
            lastTimestamp: nowIso,
            peerAvatarUrl: newRecipient.avatar_url ?? null,
        }

        setDraftConversations((prev) => [convo, ...prev])
        setActiveConversationId(conversationId)
        setMobileView("chat")
        setShowNewMessage(false)

        setNewRecipient(null)
        setRecipientQuery("")
        setRecipientResults([])
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!activeConversation) {
            toast.error("Select a conversation first.")
            return
        }

        const text = draft.trim()
        if (!text) return

        if (!activeConversation.peerId) {
            toast.error("This conversation has no recipient id. Please create a new message and pick a recipient.")
            return
        }

        const tempId = `local-${++localIdRef.current}`
        const nowIso = new Date().toISOString()

        const optimistic: UiMessage = {
            id: tempId,
            conversationId: activeConversation.id,
            sender: "admin",
            senderName: adminName,
            content: text,
            createdAt: nowIso,
            isUnread: false,
            senderId: myUserId || null,
            recipientRole: activeConversation.peerRole,
            recipientId: activeConversation.peerId ?? null,
        }

        setMessagesByConversation((prev) => {
            const current = prev[activeConversation.id] ?? []
            return { ...prev, [activeConversation.id]: [...current, optimistic] }
        })

        setDraft("")
        setIsSending(true)

        try {
            const payload: any = {
                content: text,
                recipient_role: activeConversation.peerRole,
                recipient_id: activeConversation.peerId,
                // don't send local "new-..." ids as conversation_id; let backend canonicalize
                ...(activeConversation.id.startsWith("new-") ? {} : { conversation_id: activeConversation.id }),
            }

            const res: any = await sendAdminMessage(payload)
            const dto = res?.messageRecord ?? res?.data ?? res?.message ?? res?.record ?? null

            // Refresh the active conversation from server if possible
            await loadConversations("refresh")

            if (dto && (dto.id != null || dto.content != null)) {
                const serverMsg = mapAdminMessageToUi(dto as AdminMessage, activeConversation.id)

                // if backend returned a canonical conversation id, switch to it
                const serverConversationId = serverMsg.conversationId && !String(serverMsg.conversationId).startsWith("new-")
                    ? String(serverMsg.conversationId)
                    : activeConversation.id

                // replace optimistic
                setMessagesByConversation((prev) => {
                    const oldId = activeConversation.id
                    const arr = prev[oldId] ?? []
                    const replaced = arr.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m))

                    // if conversationId changed, move messages
                    if (serverConversationId !== oldId) {
                        const moved = replaced.map((m) => ({ ...m, conversationId: serverConversationId }))
                        const existing = prev[serverConversationId] ?? []
                        return {
                            ...prev,
                            [oldId]: undefined as any,
                            [serverConversationId]: [...existing, ...moved].filter(Boolean),
                        }
                    }

                    return { ...prev, [oldId]: replaced }
                })

                if (serverConversationId !== activeConversation.id) {
                    setActiveConversationId(serverConversationId)
                    setDraftConversations((prev) => prev.filter((c) => c.id !== activeConversation.id))
                    await loadConversationMessages(serverConversationId)
                } else {
                    // remove draft if it was draft
                    setDraftConversations((prev) => prev.filter((c) => c.id !== activeConversation.id))
                    await loadConversationMessages(activeConversation.id)
                }
            } else {
                // no dto: just reload messages for current view
                if (!activeConversation.id.startsWith("new-")) await loadConversationMessages(activeConversation.id)
            }
        } catch (err) {
            // rollback optimistic
            setMessagesByConversation((prev) => {
                const arr = prev[activeConversation.id] ?? []
                return { ...prev, [activeConversation.id]: arr.filter((m) => m.id !== tempId) }
            })
            toast.error(err instanceof Error ? err.message : "Failed to send message.")
        } finally {
            setIsSending(false)
        }
    }

    // ===== Edit / Delete message =====
    const canEdit = (m: UiMessage) => m.sender !== "system"
    const canDelete = (m: UiMessage) => m.sender !== "system"

    const openEdit = (m: UiMessage) => {
        setEditingMessage(m)
        setEditDraft(m.content)
        setEditOpen(true)
    }

    const saveEdit = async () => {
        if (!editingMessage) return
        const next = editDraft.trim()
        if (!next) {
            toast.error("Message cannot be empty.")
            return
        }

        const convoId = activeConversationId
        const id = editingMessage.id
        const prevContent = editingMessage.content

        setIsSavingEdit(true)

        // optimistic update
        setMessagesByConversation((prev) => {
            const arr = prev[convoId] ?? []
            return { ...prev, [convoId]: arr.map((m) => (m.id === id ? { ...m, content: next } : m)) }
        })

        try {
            await updateAdminMessage(id, next)
            setEditOpen(false)
            setEditingMessage(null)
            toast.success("Message updated.")
            await loadConversations("refresh")
        } catch (err) {
            // rollback
            setMessagesByConversation((prev) => {
                const arr = prev[convoId] ?? []
                return { ...prev, [convoId]: arr.map((m) => (m.id === id ? { ...m, content: prevContent } : m)) }
            })
            toast.error(err instanceof Error ? err.message : "Failed to update message.")
        } finally {
            setIsSavingEdit(false)
        }
    }

    const askDeleteMessage = (m: UiMessage) => {
        setDeletingMessage(m)
        setDeleteMsgOpen(true)
    }

    const confirmDeleteMessage = async () => {
        if (!deletingMessage) return
        const convoId = activeConversationId
        const target = deletingMessage

        setIsDeletingMsg(true)

        let removed: { msg: UiMessage; index: number } | null = null
        setMessagesByConversation((prev) => {
            const arr = prev[convoId] ?? []
            const index = arr.findIndex((x) => x.id === target.id)
            removed = { msg: target, index: index < 0 ? arr.length : index }
            return { ...prev, [convoId]: arr.filter((x) => x.id !== target.id) }
        })

        try {
            await deleteAdminMessage(target.id)
            toast.success("Message deleted.")
            setDeleteMsgOpen(false)
            setDeletingMessage(null)
            await loadConversations("refresh")
        } catch (err) {
            if (removed) {
                setMessagesByConversation((prev) => {
                    const arr = [...(prev[convoId] ?? [])]
                    const idx = Math.max(0, Math.min(removed!.index, arr.length))
                    arr.splice(idx, 0, removed!.msg)
                    return { ...prev, [convoId]: arr }
                })
            }
            toast.error(err instanceof Error ? err.message : "Failed to delete message.")
        } finally {
            setIsDeletingMsg(false)
        }
    }

    // ===== Delete conversation =====
    const askDeleteConversation = () => {
        if (!activeConversation) return
        setDeleteConvoOpen(true)
    }

    const confirmDeleteConversation = async () => {
        if (!activeConversation) return

        const convoId = activeConversation.id
        const nextCandidate = mergedConversations.filter((c) => c.id !== convoId)[0]?.id ?? ""

        setIsDeletingConvo(true)

        const prevMessages = messagesByConversation[convoId] ?? []
        const prevDraft = draftConversations.find((d) => d.id === convoId) ?? null

        // optimistic remove
        setConversations((prev) => prev.filter((c) => c.id !== convoId))
        setDraftConversations((prev) => prev.filter((d) => d.id !== convoId))
        setMessagesByConversation((prev) => {
            const next = { ...prev }
            delete next[convoId]
            return next
        })

        try {
            await deleteAdminConversation(convoId)
            toast.success("Conversation deleted.")
            setDeleteConvoOpen(false)
            setActiveConversationId(nextCandidate)
            if (!nextCandidate) setMobileView("list")
        } catch (err) {
            // rollback
            await loadConversations("refresh")
            setMessagesByConversation((prev) => ({ ...prev, [convoId]: prevMessages }))
            if (prevDraft) setDraftConversations((prev) => [prevDraft, ...prev])
            toast.error(err instanceof Error ? err.message : "Failed to delete conversation.")
        } finally {
            setIsDeletingConvo(false)
        }
    }

    const activePeerName = activeConversation ? activeConversation.peerName : ""
    const activePeerAvatarSrc = resolveAvatarSrc(activeConversation?.peerAvatarUrl ?? null)

    return (
        <DashboardLayout title="Messages" description="Admin messaging: send messages to any user and manage conversations.">
            <div className="mx-auto w-full px-4">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2 p-4 sm:p-6">
                        <CardTitle className="text-base">
                            <span className="sm:hidden">Inbox</span>
                            <span className="hidden sm:inline">Admin Messages</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            <span className="sm:hidden">Send messages and manage threads.</span>
                            <span className="hidden sm:inline">Create new messages, view conversations, edit/delete messages.</span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-[640px] grid-cols-1 md:min-h-[700px] md:grid-cols-[360px_1fr]">
                            {/* LEFT: conversations */}
                            <div className={cn("border-b md:border-b-0 md:border-r", mobileView === "chat" ? "hidden md:block" : "block")}>
                                <div className="p-3 sm:p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-900">Inbox</div>
                                            <div className="truncate text-xs text-muted-foreground">{adminName}</div>
                                        </div>

                                        <Badge variant="secondary" className="w-fit text-[0.70rem] sm:text-[0.70rem]">
                                            Admin
                                        </Badge>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 w-full text-[0.85rem] sm:h-9 sm:text-xs"
                                        onClick={() => setShowNewMessage((v) => !v)}
                                    >
                                        {showNewMessage ? "Close new message" : "Create new message"}
                                    </Button>

                                    {showNewMessage ? (
                                        <div className="mt-3 rounded-xl border bg-white/60 p-3">
                                            <div className="grid grid-cols-1 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[0.70rem] font-medium text-slate-700">Recipient role</Label>
                                                    <Select
                                                        value={newRole}
                                                        onValueChange={(v) => {
                                                            const nextRole = v as PeerRole
                                                            setNewRole(nextRole)
                                                            setNewRecipient(null)
                                                            setRecipientQuery("")
                                                            setRecipientResults([])
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 sm:h-9">
                                                            <SelectValue placeholder="Select role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="student">Student</SelectItem>
                                                            <SelectItem value="guest">Guest</SelectItem>
                                                            <SelectItem value="counselor">Counselor</SelectItem>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="referral_user">Referral User</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <Label className="text-[0.70rem] font-medium text-slate-700">Recipient (required)</Label>

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
                                                        placeholder={`Type name or ID (${roleLabel(newRole)})…`}
                                                        emptyText={
                                                            recipientQuery.trim().length < 2
                                                                ? "Type at least 2 characters to search."
                                                                : `No ${roleLabel(newRole).toLowerCase()} found.`
                                                        }
                                                    />

                                                    <div className="text-[0.70rem] text-muted-foreground">
                                                        <span className="sm:hidden">Searches your database (not history).</span>
                                                        <span className="hidden sm:inline">
                                                            Tip: This searches your database (not message history). If nothing appears, confirm your backend endpoint.
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    className="mt-2 h-10 text-[0.85rem] sm:h-9 sm:text-xs"
                                                    onClick={startNewConversation}
                                                    disabled={!newRecipient}
                                                >
                                                    Start
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <Tabs value={roleFilter} onValueChange={(v: any) => setRoleFilter(v as any)}>
                                        <TabsList className="mt-3 flex w-full justify-start gap-1 overflow-x-auto whitespace-nowrap px-1 sm:grid sm:grid-cols-6 sm:px-0">
                                            <TabsTrigger value="all" className="min-w-[72px] text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                All
                                            </TabsTrigger>
                                            <TabsTrigger value="student" className="min-w-[72px] text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                Student
                                            </TabsTrigger>
                                            <TabsTrigger value="guest" className="min-w-[72px] text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                Guest
                                            </TabsTrigger>
                                            <TabsTrigger value="counselor" className="min-w-[72px] text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                Counselor
                                            </TabsTrigger>
                                            <TabsTrigger value="admin" className="min-w-[72px] text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                Admin
                                            </TabsTrigger>
                                            <TabsTrigger value="referral_user" className="min-w-24 text-[0.70rem] sm:min-w-0 sm:text-xs">
                                                Referral
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

                                <ScrollArea className="h-[520px] sm:h-[560px]">
                                    <div className="space-y-2 p-3 sm:p-4">
                                        {isLoading ? (
                                            <div className="text-sm text-muted-foreground">Loading conversations…</div>
                                        ) : filteredConversations.length === 0 ? (
                                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">No conversations found.</div>
                                        ) : (
                                            filteredConversations.map((c) => {
                                                const active = c.id === activeConversationId
                                                const avatarSrc = resolveAvatarSrc(c.peerAvatarUrl ?? null)
                                                const displayName = c.peerName

                                                return (
                                                    <Button
                                                        key={c.id}
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setActiveConversationId(c.id)
                                                            setMobileView("chat")
                                                        }}
                                                        className={cn(
                                                            "h-auto w-full justify-start rounded-xl border p-0 text-left",
                                                            active ? "bg-white shadow-sm hover:bg-white" : "bg-white/60 hover:bg-white",
                                                        )}
                                                    >
                                                        <div className="w-full p-2.5 sm:p-3">
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                                    <Avatar className="h-8 w-8 border sm:h-9 sm:w-9">
                                                                        <AvatarImage src={avatarSrc ?? undefined} alt={displayName} className="object-cover" loading="lazy" />
                                                                        <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">
                                                                            {initials(displayName)}
                                                                        </AvatarFallback>
                                                                    </Avatar>

                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-[0.92rem] font-semibold text-slate-900 sm:text-sm">
                                                                            {displayName}
                                                                        </div>
                                                                        <div className="truncate text-[0.72rem] text-muted-foreground sm:text-xs">{c.subtitle}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between gap-2 sm:justify-end">
                                                                    <span className="text-[0.72rem] text-muted-foreground sm:text-xs">{formatShort(c.lastTimestamp)}</span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 line-clamp-2 text-[0.72rem] text-muted-foreground sm:truncate sm:text-xs">
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
                            <div className={cn("flex flex-col", mobileView === "list" ? "hidden md:flex" : "flex")}>
                                <div className="flex flex-col gap-3 border-b bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
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
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <Avatar className="h-9 w-9 border sm:h-10 sm:w-10">
                                                    <AvatarImage src={activePeerAvatarSrc ?? undefined} alt={activePeerName} className="object-cover" loading="lazy" />
                                                    <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">{initials(activePeerName)}</AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">{activePeerName}</div>
                                                    <div className="truncate text-[0.72rem] text-muted-foreground sm:text-xs">
                                                        {roleLabel(activeConversation.peerRole)} • {activeConversation.subtitle}
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
                                                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" disabled={!activeConversation}>
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
                                    </div>
                                </div>

                                <ScrollArea className="h-[480px] bg-linear-to-b from-muted/30 to-white sm:h-[520px]">
                                    <div className="space-y-3 p-3 sm:p-4">
                                        {!activeConversation ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">Choose a conversation from the left.</div>
                                        ) : isLoading ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                                        ) : activeMessages.length === 0 ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">No messages yet.</div>
                                        ) : (
                                            activeMessages.map((m) => {
                                                const mine = m.sender === "admin" && String(m.senderId ?? "") === myUserId
                                                const system = m.sender === "system"
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start"

                                                const bubble = system ? "border bg-white/90" : mine ? "border-indigo-200 bg-indigo-50/90" : "border-slate-200 bg-white/90"

                                                return (
                                                    <div key={m.id} className={`flex ${align}`}>
                                                        <div className="max-w-[94%] sm:max-w-[86%]">
                                                            {system ? (
                                                                <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">
                                                                    <span className="sm:hidden">{formatTimeOnly(m.createdAt)}</span>
                                                                    <span className="hidden sm:inline">{formatTimestamp(m.createdAt)}</span>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className={cn(
                                                                        "mb-1 flex flex-wrap items-center gap-2 text-[0.70rem] text-muted-foreground",
                                                                        mine ? "justify-end" : "justify-start",
                                                                    )}
                                                                >
                                                                    <span className="font-medium text-slate-700">{mine ? "You" : m.senderName}</span>
                                                                    <span aria-hidden="true">•</span>

                                                                    <span className="sm:hidden">{formatTimeOnly(m.createdAt)}</span>
                                                                    <span className="hidden sm:inline">{formatTimestamp(m.createdAt)}</span>

                                                                    {(canEdit(m) || canDelete(m)) && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 sm:h-6 sm:w-6">
                                                                                    <MoreVertical className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align={mine ? "end" : "start"}>
                                                                                {canEdit(m) && (
                                                                                    <DropdownMenuItem
                                                                                        onSelect={(e) => {
                                                                                            e.preventDefault()
                                                                                            openEdit(m)
                                                                                        }}
                                                                                    >
                                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                                        Edit
                                                                                    </DropdownMenuItem>
                                                                                )}
                                                                                {canEdit(m) && canDelete(m) ? <DropdownMenuSeparator /> : null}
                                                                                {canDelete(m) && (
                                                                                    <DropdownMenuItem
                                                                                        className="text-destructive focus:text-destructive"
                                                                                        onSelect={(e) => {
                                                                                            e.preventDefault()
                                                                                            askDeleteMessage(m)
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                                        Delete
                                                                                    </DropdownMenuItem>
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className={`rounded-2xl border px-3 py-2 text-[0.90rem] leading-relaxed shadow-sm sm:text-sm ${bubble}`}>
                                                                {m.content}
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
                                                placeholder={activeConversation ? `Message ${activePeerName}…` : "Select a conversation…"}
                                                disabled={!activeConversation || isSending}
                                                className="min-h-12 resize-none rounded-2xl sm:min-h-11"
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="h-11 w-full rounded-2xl px-5 sm:h-11 sm:w-auto"
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

                {/* Edit dialog */}
                <Dialog open={editOpen} onOpenChange={(v) => (!isSavingEdit ? setEditOpen(v) : null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit message</DialogTitle>
                            <DialogDescription>Update the message then save.</DialogDescription>
                        </DialogHeader>

                        <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="min-h-28" />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isSavingEdit}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={saveEdit} disabled={isSavingEdit || !editDraft.trim()}>
                                {isSavingEdit ? "Saving…" : "Save changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete message confirm */}
                <AlertDialog open={deleteMsgOpen} onOpenChange={(v) => (!isDeletingMsg ? setDeleteMsgOpen(v) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete message?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingMsg}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDeleteMessage}
                                disabled={isDeletingMsg}
                                className="bg-destructive text-white hover:bg-destructive/90"
                            >
                                {isDeletingMsg ? "Deleting…" : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete conversation confirm */}
                <AlertDialog open={deleteConvoOpen} onOpenChange={(v) => (!isDeletingConvo ? setDeleteConvoOpen(v) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                            <AlertDialogDescription>This will remove the entire thread (all messages) from the admin view.</AlertDialogDescription>
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
            </div>
        </DashboardLayout>
    )
}

export default AdminMessages
