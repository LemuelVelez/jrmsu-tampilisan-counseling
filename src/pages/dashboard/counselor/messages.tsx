/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/authentication";
import {
    fetchCounselorMessages,
    sendCounselorMessage,
    markCounselorMessagesAsRead,
    type CounselorMessage,
} from "@/lib/messages";
import { markCounselorMessageReadByIdApi } from "@/api/messages/[id]/route";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";

type PeerRole = "student" | "guest" | "counselor" | "admin";

type UiMessage = {
    id: number | string;
    conversationId: string;

    sender: "student" | "guest" | "counselor" | "system";
    senderName: string;
    content: string;
    createdAt: string;

    isUnread: boolean;

    senderId?: number | string | null;
    recipientId?: number | string | null;

    /**
     * ✅ FIX:
     * Normalize recipientRole so it is always one of: student|guest|counselor|admin|null.
     * This prevents wrong peerRole (e.g. "Student", "students") which breaks avatar backfill.
     */
    recipientRole?: PeerRole | null;

    userId?: number | string | null;

    // ✅ avatar hints (best-effort)
    senderAvatarUrl?: string | null;
    recipientAvatarUrl?: string | null;
};

type Conversation = {
    id: string;
    peerRole: PeerRole;
    peerName: string;
    peerId?: number | string | null;

    subtitle: string;
    unreadCount: number;
    lastMessage?: string;
    lastTimestamp?: string;

    // ✅ avatar (best-effort)
    peerAvatarUrl?: string | null;
};

type DirectoryUser = {
    id: number | string;
    name: string;
    role: PeerRole;
    avatar_url?: string | null;
};

type AutoStartConversationPayload = {
    role: PeerRole;
    id: number | string;
    name?: string;
};

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined;
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined;

function resolveApiUrl(path: string): string {
    if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.");
    const trimmed = path.replace(/^\/+/, "");
    return `${API_BASE_URL}/${trimmed}`;
}

function getApiOrigin(): string {
    if (!API_BASE_URL) return "";
    try {
        return new URL(API_BASE_URL).origin;
    } catch {
        return "";
    }
}

function looksLikeFilePath(s: string): boolean {
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    );
}

/**
 * Supports common Laravel avatar storage formats:
 * - "avatars/foo.jpg"                 -> "/storage/avatars/foo.jpg"
 * - "public/avatars/foo.jpg"          -> "/storage/avatars/foo.jpg"
 * - "storage/app/public/avatars/..."  -> "/storage/avatars/..."
 * - "/storage/avatars/foo.jpg"        -> "/storage/avatars/foo.jpg"
 * - Absolute URLs stay untouched
 *
 * ✅ FIX:
 * If backend accidentally returns absolute URLs containing "/api/storage/...",
 * rewrite them to "/storage/..." because your public storage route is "/storage/*".
 */
function resolveAvatarSrc(raw?: string | null): string | null {
    const s0 = typeof raw === "string" ? raw : "";
    let s = s0.trim();
    if (!s) return null;

    s = s.replace(/\\/g, "/");

    if (/^(data:|blob:)/i.test(s)) return s;

    if (/^https?:\/\//i.test(s)) {
        try {
            const u = new URL(s);
            const p = (u.pathname || "").replace(/\\/g, "/");

            // normalize common wrong absolute paths
            u.pathname = p
                .replace(/^\/api\/storage\//i, "/storage/")
                .replace(/^\/api\/public\/storage\//i, "/storage/")
                .replace(/^\/storage\/app\/public\//i, "/storage/");

            return u.toString();
        } catch {
            return s;
        }
    }

    if (s.startsWith("//")) return `${window.location.protocol}${s}`;

    s = s.replace(/^storage\/app\/public\//i, "");
    s = s.replace(/^public\//i, "");

    const normalized = s.replace(/^\/+/, "");
    const alreadyStorage =
        normalized.toLowerCase().startsWith("storage/") ||
        normalized.toLowerCase().startsWith("api/storage/");

    let path = normalized;
    if (!alreadyStorage && looksLikeFilePath(normalized)) {
        path = `storage/${normalized}`;
    }

    // also normalize relative "api/storage/..." to "storage/..."
    path = path.replace(/^api\/storage\//i, "storage/");

    const finalPath = path.startsWith("/") ? path : `/${path}`;
    const origin = getApiOrigin();
    return origin ? `${origin}${finalPath}` : finalPath;
}

function pickAvatarUrl(obj: any): string | null {
    const candidates = [
        obj?.avatar_url,
        obj?.avatarUrl,
        obj?.avatar,
        obj?.profile_picture,
        obj?.profile_picture_url,
        obj?.profile_photo_url,
        obj?.photo_url,
        obj?.image_url,
        obj?.picture,
        obj?.photo,

        // message-shaped payloads
        obj?.sender_avatar_url,
        obj?.sender_avatar,
        obj?.recipient_avatar_url,
        obj?.recipient_avatar,
    ];

    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
    }

    // nested objects
    const nested = [
        obj?.user,
        obj?.sender_user,
        obj?.senderUser,
        obj?.sender,
        obj?.recipient_user,
        obj?.recipientUser,
        obj?.recipient,
    ];

    for (const n of nested) {
        if (!n) continue;
        const v =
            (typeof n?.avatar_url === "string" && n.avatar_url.trim()) ||
            (typeof n?.profile_photo_url === "string" && n.profile_photo_url.trim()) ||
            (typeof n?.photo_url === "string" && n.photo_url.trim()) ||
            "";
        if (v) return String(v).trim();
    }

    return null;
}

async function apiFetch(path: string, init: RequestInit, token?: string | null): Promise<unknown> {
    const url = resolveApiUrl(path);
    const res = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
        },
    });

    const text = await res.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText || "Server request failed.";
        throw new Error(msg);
    }

    return data;
}

async function tryDeleteMessageApi(messageId: number, token?: string | null) {
    const candidates = [`/messages/${messageId}`, `/message/${messageId}`];
    let lastErr: any = null;

    for (const p of candidates) {
        try {
            await apiFetch(p, { method: "DELETE" }, token);
            return;
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr ?? new Error("Failed to delete message.");
}

async function tryUpdateMessageApi(messageId: number, content: string, token?: string | null) {
    const payload = JSON.stringify({ content });
    try {
        await apiFetch(`/messages/${messageId}`, { method: "PATCH", body: payload }, token);
        return;
    } catch {
        await apiFetch(`/messages/${messageId}`, { method: "PUT", body: payload }, token);
    }
}

/**
 * Delete (hide) a conversation for the current user.
 * IMPORTANT: We DO NOT fallback to deleting each message anymore.
 * The backend now supports "delete conversation" semantics persistently.
 */
async function tryDeleteConversationApi(conversationId: string, token?: string | null) {
    const candidates = [
        `/messages/conversations/${encodeURIComponent(conversationId)}`,
        `/conversations/${encodeURIComponent(conversationId)}`,
        `/messages/thread/${encodeURIComponent(conversationId)}`,
    ];

    let lastErr: any = null;

    for (const p of candidates) {
        try {
            await apiFetch(p, { method: "DELETE" }, token);
            return;
        } catch (e) {
            lastErr = e;
        }
    }

    throw lastErr ?? new Error("Failed to delete conversation.");
}

function extractUsersArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const candidates = [
        payload.users,
        payload.data,
        payload.results,
        payload.items,
        payload.records,
        payload?.payload?.users,
        payload?.payload?.data,
    ];

    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    return [];
}

function extractUserName(u: any): string {
    const name =
        (u?.name && String(u.name).trim()) ||
        (u?.full_name && String(u.full_name).trim()) ||
        (u?.fullname && String(u.fullname).trim()) ||
        (u?.display_name && String(u.display_name).trim()) ||
        (u?.first_name || u?.last_name ? `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() : "") ||
        "";
    return name || "Unknown";
}

/**
 * IMPORTANT:
 * Role is the basis, NOT account_type.
 * We only map explicit role-like fields (role / role_name / type).
 */
function toPeerRole(role: any): PeerRole | null {
    if (role == null) return null;
    const r = String(role).trim().toLowerCase();

    if (r === "student") return "student";
    if (r === "guest") return "guest";
    if (r === "counselor") return "counselor";
    if (r === "admin") return "admin";

    // common alternates
    if (r === "guidance" || r === "guidance_counselor" || r === "guidance counselor") return "counselor";
    if (r === "administrator" || r === "superadmin" || r === "super_admin") return "admin";

    if (r === "students") return "student";
    if (r === "guests") return "guest";
    if (r === "counselors") return "counselor";
    if (r === "admins") return "admin";

    return null;
}

function normalizeRecipientRole(raw: any): PeerRole | null {
    return toPeerRole(raw);
}

/**
 * Fetch users from DB (NOT from message history).
 *
 * ✅ FIXED:
 * - We DO NOT use account_type for role mapping anymore.
 * - Only the actual "role" (or role-like fields) is respected.
 *
 * ✅ ALSO:
 * - Added "admin" recipient role support.
 *
 * ✅ AVATAR:
 * - Map avatar_url so draft conversations can show images immediately.
 */
async function trySearchUsersFromDb(role: PeerRole, query: string, token?: string | null): Promise<DirectoryUser[]> {
    const q = query.trim();
    const roleParam = encodeURIComponent(role);

    const candidates: string[] = [];

    if (q.length > 0) {
        const qq = encodeURIComponent(q);

        candidates.push(`/${role}s?search=${qq}`);
        candidates.push(`/${role}s/search?q=${qq}`);
        candidates.push(`/${role}s?query=${qq}`);
        candidates.push(`/${role}s?q=${qq}`);

        candidates.push(`/users?role=${roleParam}&search=${qq}`);
        candidates.push(`/users?role=${roleParam}&q=${qq}`);
        candidates.push(`/users/search?role=${roleParam}&q=${qq}`);
        candidates.push(`/search/users?role=${roleParam}&q=${qq}`);
    } else {
        candidates.push(`/${role}s?limit=20`);
        candidates.push(`/${role}s?per_page=20`);

        candidates.push(`/users?role=${roleParam}&limit=20`);
        candidates.push(`/users?role=${roleParam}&per_page=20`);
    }

    let lastErr: any = null;

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET" }, token);
            const arr = extractUsersArray(data);
            if (!Array.isArray(arr)) continue;

            const mapped: DirectoryUser[] = arr
                .map((raw: any) => {
                    const u = raw?.user ?? raw;

                    const id = u?.id ?? u?.user_id ?? u?.account_id ?? u?.student_id ?? u?.counselor_id;
                    if (id == null || String(id).trim() === "") return null;

                    const name = extractUserName(u);

                    const dbRole = toPeerRole(u?.role) ?? toPeerRole(u?.role_name) ?? toPeerRole(u?.type);
                    if (!dbRole) return null;
                    if (dbRole !== role) return null;

                    const avatarRaw = pickAvatarUrl(u) ?? pickAvatarUrl(raw) ?? null;

                    return {
                        id,
                        name,
                        role: dbRole,
                        avatar_url: avatarRaw,
                    } as DirectoryUser;
                })
                .filter(Boolean) as DirectoryUser[];

            const seen = new Set<string>();
            const deduped = mapped.filter((u) => {
                const key = `${u.role}-${String(u.id)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return deduped;
        } catch (e) {
            lastErr = e;
        }
    }

    throw lastErr ?? new Error("Failed to search users from database.");
}

/**
 * ✅ Fetch a single user's avatar by (role, id) for conversations coming from message history
 * (where the inbox API may not include avatar fields).
 */
async function tryFetchUserAvatarById(
    role: PeerRole,
    id: number | string,
    token?: string | null,
    signal?: AbortSignal,
): Promise<string | null> {
    const sid = String(id).trim();
    if (!sid) return null;

    const roleParam = encodeURIComponent(role);
    const q = encodeURIComponent(sid);

    const candidates = [
        `/${role}s?search=${q}&limit=1`,
        `/${role}s?q=${q}&limit=1`,
        `/${role}s?query=${q}&limit=1`,
        `/users?role=${roleParam}&search=${q}&limit=1`,
        `/users?role=${roleParam}&q=${q}&limit=1`,
    ];

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET", signal }, token);
            const arr = extractUsersArray(data);
            if (!Array.isArray(arr) || arr.length === 0) continue;

            const found =
                arr
                    .map((raw: any) => raw?.user ?? raw)
                    .find((u: any) => String(u?.id ?? u?.user_id ?? u?.account_id ?? "").trim() === sid) ??
                (arr[0]?.user ?? arr[0]);

            const avatarRaw = pickAvatarUrl(found) ?? null;
            return avatarRaw;
        } catch {
            // keep trying next candidate
        }
    }

    return null;
}

const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "MMM d, yyyy • h:mm a");
};

const formatTimeOnly = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "h:mm a");
};

const formatShort = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return format(d, "MMM d");
};

const initials = (name: string) => {
    const cleaned = (name || "").trim();
    if (!cleaned) return "GC";
    const parts = cleaned.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "GC";
};

const roleLabel = (r: PeerRole) =>
    r === "counselor" ? "Counselor" : r === "guest" ? "Guest" : r === "admin" ? "Admin" : "Student";

function normalizeSender(sender: CounselorMessage["sender"]): UiMessage["sender"] {
    if (sender === "student" || sender === "guest" || sender === "counselor" || sender === "system") return sender;
    return "system";
}

function isUnreadFlag(dto: CounselorMessage): boolean {
    return dto.is_read === false || dto.is_read === 0;
}

function safeConversationId(dto: CounselorMessage): string {
    const raw = (dto as any).conversation_id ?? dto.conversation_id;
    if (raw != null && String(raw).trim()) return String(raw);

    const sender = normalizeSender(dto.sender);
    const senderId = (dto as any).sender_id ?? null;

    const recipientRoleRaw = (dto as any).recipient_role ?? (dto as any).recipientRole ?? null;
    const recipientRole = normalizeRecipientRole(recipientRoleRaw);

    const recipientId = (dto as any).recipient_id ?? null;

    const userId = (dto as any).user_id ?? dto.user_id ?? null;

    if ((sender === "student" || sender === "guest") && userId != null) return `${sender}-${userId}`;
    if ((recipientRole === "student" || recipientRole === "guest" || recipientRole === "admin") && recipientId != null) {
        return `${recipientRole}-${recipientId}`;
    }
    if (userId != null) return `student-${userId}`;

    if (sender === "counselor" && recipientRole === "counselor" && senderId != null && recipientId != null) {
        const a = `counselor-${String(senderId)}`;
        const b = `counselor-${String(recipientId)}`;
        const [x, y] = [a, b].sort();
        return `${x}__${y}`;
    }

    if (sender === "counselor" && senderId != null) return `counselor-${senderId}`;
    if (recipientRole === "counselor" && recipientId != null) return `counselor-${recipientId}`;

    return "general";
}

function mapDtoToUi(dto: CounselorMessage): UiMessage {
    const sender = normalizeSender(dto.sender);

    const senderName =
        (dto.sender_name && String(dto.sender_name).trim()) ||
        (sender === "system"
            ? "Guidance & Counseling Office"
            : sender === "counselor"
                ? "Counselor"
                : sender === "guest"
                    ? "Guest"
                    : "Student");

    const createdAt = dto.created_at ?? new Date(0).toISOString();

    const senderAvatarUrl =
        pickAvatarUrl(dto as any) ??
        pickAvatarUrl((dto as any)?.sender) ??
        pickAvatarUrl((dto as any)?.user) ??
        null;

    const recipientAvatarUrl =
        pickAvatarUrl((dto as any)?.recipient) ??
        pickAvatarUrl((dto as any)?.recipient_user) ??
        (typeof (dto as any)?.recipient_avatar_url === "string" ? (dto as any).recipient_avatar_url : null);

    const recipientRoleRaw = (dto as any).recipient_role ?? (dto as any).recipientRole ?? null;
    const recipientRole = normalizeRecipientRole(recipientRoleRaw);

    return {
        id: dto.id ?? `${createdAt}-${sender}-${Math.random().toString(36).slice(2)}`,
        conversationId: safeConversationId(dto),
        sender,
        senderName,
        content: dto.content ?? "",
        createdAt,
        isUnread: isUnreadFlag(dto),

        senderId: (dto as any).sender_id ?? null,
        recipientId: (dto as any).recipient_id ?? null,
        recipientRole,
        userId: (dto as any).user_id ?? null,

        senderAvatarUrl,
        recipientAvatarUrl,
    };
}

function buildConversations(messages: UiMessage[], myUserId: string, counselorName: string): Conversation[] {
    const grouped = new Map<string, UiMessage[]>();
    for (const m of messages) {
        const arr = grouped.get(m.conversationId) ?? [];
        arr.push(m);
        grouped.set(m.conversationId, arr);
    }

    const conversations: Conversation[] = [];

    for (const [conversationId, msgs] of grouped.entries()) {
        const ordered = [...msgs].sort((a, b) => {
            const ta = new Date(a.createdAt).getTime();
            const tb = new Date(b.createdAt).getTime();
            if (ta !== tb) return ta - tb;
            return String(a.id).localeCompare(String(b.id));
        });

        const last = ordered[ordered.length - 1];
        const unreadCount = ordered.filter((m) => m.isUnread).length;

        const peerMsg =
            ordered.find((m) => {
                if (m.sender === "system") return false;
                if (m.sender !== "counselor") return true;
                const sid = m.senderId != null ? String(m.senderId) : "";
                return sid && sid !== myUserId;
            }) ?? last;

        let peerRole: PeerRole = "counselor";
        let peerName = "Counselor Office";
        let peerId: number | string | null | undefined = null;

        const mySentCounselor = peerMsg.sender === "counselor" && String(peerMsg.senderId ?? "") === myUserId;

        if (!mySentCounselor && peerMsg.sender !== "system") {
            peerRole = (peerMsg.sender === "student" || peerMsg.sender === "guest" || peerMsg.sender === "counselor"
                ? peerMsg.sender
                : "counselor") as PeerRole;

            peerName =
                peerMsg.sender === "counselor" && peerMsg.senderName === counselorName
                    ? "Counselor"
                    : peerMsg.senderName || roleLabel(peerRole);

            peerId = peerMsg.senderId ?? peerMsg.userId ?? null;
        } else {
            const rr = peerMsg.recipientRole ?? "counselor";
            peerRole = rr;
            peerId = peerMsg.recipientId ?? null;

            if (peerRole === "student" || peerRole === "guest" || peerRole === "admin") {
                peerName = peerId ? `${roleLabel(peerRole)} #${peerId}` : roleLabel(peerRole);
            } else {
                peerName = peerId ? `Counselor #${peerId}` : "Counselor Office";
            }
        }

        const subtitle =
            peerRole === "counselor"
                ? "Counselor thread"
                : peerRole === "guest"
                    ? "Guest thread"
                    : peerRole === "admin"
                        ? "Admin thread"
                        : "Student thread";

        const peerAvatarUrl =
            !mySentCounselor && peerMsg.sender !== "system"
                ? (peerMsg.senderAvatarUrl ?? null)
                : (peerMsg.recipientAvatarUrl ?? null);

        conversations.push({
            id: conversationId,
            peerRole,
            peerName,
            peerId,
            subtitle,
            unreadCount,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
            peerAvatarUrl,
        });
    }

    conversations.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return tb - ta;
    });

    return conversations;
}

function peerKey(role: PeerRole, id?: number | string | null): string | null {
    if (id == null || String(id).trim() === "") return null;
    return `${role}-${String(id)}`;
}

function UserCombobox(props: {
    users: DirectoryUser[];
    value: DirectoryUser | null;
    onChange: (u: DirectoryUser) => void;

    searchValue: string;
    onSearchValueChange: (v: string) => void;
    isLoading?: boolean;

    placeholder?: string;
    emptyText?: string;
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
    } = props;

    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between sm:h-9">
                    <span className={cn("min-w-0 truncate text-left", !value ? "text-muted-foreground" : "")}>
                        {value ? `${value.name} • ID: ${value.id}` : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Type name or ID…" value={searchValue} onValueChange={(v) => onSearchValueChange(v)} />
                    <CommandList>
                        <CommandEmpty>{isLoading ? "Searching…" : emptyText}</CommandEmpty>
                        <CommandGroup>
                            {users.map((u) => {
                                const selected = !!value && value.role === u.role && String(value.id) === String(u.id);
                                return (
                                    <CommandItem
                                        key={`${u.role}-${u.id}`}
                                        value={`${u.name} ${u.id}`}
                                        onSelect={() => {
                                            onChange(u);
                                            setOpen(false);
                                        }}
                                        className="gap-2"
                                    >
                                        <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm">{u.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {roleLabel(u.role)} • ID: {u.id}
                                            </div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const CounselorMessages: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const session = getCurrentSession();
    const token = (session as any)?.token ?? null;
    const counselorName = session?.user && (session.user as any).name ? String((session.user as any).name) : "Counselor";
    const myUserId = session?.user?.id != null ? String(session.user.id) : "";

    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isSending, setIsSending] = React.useState(false);
    const [isMarking, setIsMarking] = React.useState(false);

    const [roleFilter, setRoleFilter] = React.useState<"all" | PeerRole>("all");
    const [search, setSearch] = React.useState("");
    const [mobileView, setMobileView] = React.useState<"list" | "chat">("list");

    const [draft, setDraft] = React.useState("");

    const [messages, setMessages] = React.useState<UiMessage[]>([]);
    const [activeConversationId, setActiveConversationId] = React.useState<string>("");

    const [draftConversations, setDraftConversations] = React.useState<Conversation[]>([]);
    const [showNewMessage, setShowNewMessage] = React.useState(false);

    // recipients fetched from DB
    const [newRole, setNewRole] = React.useState<PeerRole>("student");
    const [newRecipient, setNewRecipient] = React.useState<DirectoryUser | null>(null);
    const [recipientQuery, setRecipientQuery] = React.useState("");
    const [recipientResults, setRecipientResults] = React.useState<DirectoryUser[]>([]);
    const [recipientLoading, setRecipientLoading] = React.useState(false);

    // ✅ avatar cache for conversations built from message history
    const [avatarByPeerKey, setAvatarByPeerKey] = React.useState<Record<string, string | null>>({});
    const avatarCacheRef = React.useRef(new Map<string, string | null>());
    const avatarInflightRef = React.useRef(new Set<string>());

    const localIdRef = React.useRef(0);
    const bottomRef = React.useRef<HTMLDivElement | null>(null);

    // Edit message dialog
    const [editOpen, setEditOpen] = React.useState(false);
    const [editingMessage, setEditingMessage] = React.useState<UiMessage | null>(null);
    const [editDraft, setEditDraft] = React.useState("");
    const [isSavingEdit, setIsSavingEdit] = React.useState(false);

    // Delete message confirm
    const [deleteMsgOpen, setDeleteMsgOpen] = React.useState(false);
    const [deletingMessage, setDeletingMessage] = React.useState<UiMessage | null>(null);
    const [isDeletingMsg, setIsDeletingMsg] = React.useState(false);

    // Delete conversation confirm
    const [deleteConvoOpen, setDeleteConvoOpen] = React.useState(false);
    const [isDeletingConvo, setIsDeletingConvo] = React.useState(false);

    // Auto-start conversation when navigating from Users page
    const autoStartRef = React.useRef<AutoStartConversationPayload | null>(null);
    React.useEffect(() => {
        const payload = (location.state as any)?.autoStartConversation as AutoStartConversationPayload | undefined;
        if (!payload) return;

        // Only allow student/guest auto-start from Users page
        if (payload.role !== "student" && payload.role !== "guest") return;

        autoStartRef.current = payload;
    }, [location.state]);

    const loadMessages = async (mode: "initial" | "refresh" = "refresh") => {
        const setBusy = mode === "initial" ? setIsLoading : setIsRefreshing;

        setBusy(true);
        try {
            const res = await fetchCounselorMessages();
            const raw = Array.isArray(res.messages) ? res.messages : [];
            const ui = raw.map(mapDtoToUi);

            setMessages(ui);

            const convs = buildConversations(ui, myUserId, counselorName);

            const current = activeConversationId;
            const hasCurrentInServer = !!current && convs.some((c) => c.id === current);
            const hasCurrentInDraft = !!current && draftConversations.some((d) => d.id === current);

            if (!current) {
                if (convs.length > 0) setActiveConversationId(convs[0].id);
                else if (draftConversations.length > 0) setActiveConversationId(draftConversations[0].id);
            } else if (!hasCurrentInServer && !hasCurrentInDraft) {
                if (convs.length > 0) setActiveConversationId(convs[0].id);
                else if (draftConversations.length > 0) setActiveConversationId(draftConversations[0].id);
                else setActiveConversationId("");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load counselor messages.");
        } finally {
            setBusy(false);
        }
    };

    const handleRefresh = async () => {
        if (isLoading || isRefreshing) return;
        await loadMessages("refresh");
    };

    const conversationsFromMessages = React.useMemo(
        () => buildConversations(messages, myUserId, counselorName),
        [messages, myUserId, counselorName],
    );

    const conversations = React.useMemo(() => {
        const map = new Map<string, Conversation>();
        for (const c of conversationsFromMessages) map.set(c.id, c);
        for (const d of draftConversations) {
            if (!map.has(d.id)) map.set(d.id, d);
        }

        const merged = Array.from(map.values());
        merged.sort((a, b) => {
            if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
            const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
            const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
            return tb - ta;
        });

        return merged;
    }, [conversationsFromMessages, draftConversations]);

    // ✅ Backfill avatars for conversations that come from message history (no avatar fields)
    React.useEffect(() => {
        const controller = new AbortController();

        const todo = conversations
            .map((c) => {
                const key = peerKey(c.peerRole, c.peerId);
                if (!key) return null;

                const already =
                    c.peerAvatarUrl ||
                    avatarByPeerKey[key] ||
                    avatarCacheRef.current.has(key) ||
                    avatarInflightRef.current.has(key);

                if (already) return null;
                return { key, role: c.peerRole, id: c.peerId! };
            })
            .filter(Boolean) as Array<{ key: string; role: PeerRole; id: number | string }>;

        if (todo.length === 0) return () => controller.abort();

        (async () => {
            for (const item of todo) {
                if (controller.signal.aborted) return;

                avatarInflightRef.current.add(item.key);
                try {
                    const avatarRaw = await tryFetchUserAvatarById(item.role, item.id, token, controller.signal);
                    avatarCacheRef.current.set(item.key, avatarRaw);
                    setAvatarByPeerKey((prev) => ({ ...prev, [item.key]: avatarRaw }));
                } finally {
                    avatarInflightRef.current.delete(item.key);
                }
            }
        })().catch(() => {
            // silent
        });

        return () => controller.abort();
    }, [conversations, token, avatarByPeerKey]);

    // Handle auto-start once conversations are available
    React.useEffect(() => {
        const payload = autoStartRef.current;
        if (!payload) return;
        if (isLoading) return;

        const targetRole = payload.role;
        const targetId = String(payload.id);

        const existing =
            conversations.find((c) => c.peerRole === targetRole && String(c.peerId ?? "") === targetId) ?? null;

        if (existing) {
            setActiveConversationId(existing.id);
            setMobileView("chat");
        } else {
            const existingDraft =
                draftConversations.find((d) => d.peerRole === targetRole && String(d.peerId ?? "") === targetId) ?? null;

            if (existingDraft) {
                setActiveConversationId(existingDraft.id);
                setMobileView("chat");
            } else {
                const nowIso = new Date().toISOString();
                const conversationId = `new-${targetRole}-${targetId}-${Date.now()}`;

                const subtitle = targetRole === "guest" ? "Guest thread" : "Student thread";

                const convo: Conversation = {
                    id: conversationId,
                    peerRole: targetRole,
                    peerName: payload.name ?? `${roleLabel(targetRole)} #${targetId}`,
                    peerId: payload.id,
                    subtitle,
                    unreadCount: 0,
                    lastMessage: "",
                    lastTimestamp: nowIso,
                    peerAvatarUrl: null,
                };

                setDraftConversations((prev) => [convo, ...prev]);
                setActiveConversationId(conversationId);
                setMobileView("chat");
            }
        }

        setShowNewMessage(false);

        autoStartRef.current = null;
        navigate("/dashboard/counselor/messages", { replace: true, state: {} });
    }, [conversations, draftConversations, isLoading, navigate]);

    const filteredConversations = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations
            .filter((c) => (roleFilter === "all" ? true : c.peerRole === roleFilter))
            .filter((c) => {
                if (!q) return true;
                return (
                    c.peerName.toLowerCase().includes(q) ||
                    c.subtitle.toLowerCase().includes(q) ||
                    roleLabel(c.peerRole).toLowerCase().includes(q)
                );
            });
    }, [conversations, roleFilter, search]);

    const activeConversation = React.useMemo(
        () => conversations.find((c) => c.id === activeConversationId) ?? null,
        [conversations, activeConversationId],
    );

    const activeMessages = React.useMemo(() => {
        if (!activeConversationId) return [];
        return messages
            .filter((m) => m.conversationId === activeConversationId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [messages, activeConversationId]);

    React.useEffect(() => {
        let mounted = true;

        const load = async () => {
            if (!mounted) return;
            await loadMessages("initial");
        };

        load();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myUserId, counselorName]);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversationId, activeMessages.length]);

    // Fetch recipients from DB (debounced)
    React.useEffect(() => {
        if (!showNewMessage) return;

        let cancelled = false;
        const q = recipientQuery.trim();

        const shouldFetch = q.length === 0 || q.length >= 2;

        if (!shouldFetch) {
            setRecipientResults([]);
            setRecipientLoading(false);
            return;
        }

        const t = window.setTimeout(async () => {
            setRecipientLoading(true);
            try {
                const users = await trySearchUsersFromDb(newRole, q, token);
                if (cancelled) return;
                setRecipientResults(users);
            } catch (err) {
                if (cancelled) return;
                setRecipientResults([]);
                toast.error(err instanceof Error ? err.message : "Failed to search users.");
            } finally {
                if (!cancelled) setRecipientLoading(false);
            }
        }, q.length === 0 ? 0 : 300);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [recipientQuery, newRole, showNewMessage, token]);

    const markConversationRead = async () => {
        if (!activeConversationId) return;

        const unread = activeMessages.filter((m) => m.isUnread);
        if (unread.length === 0) return;

        setIsMarking(true);

        try {
            const numericIds = unread
                .map((m) => (typeof m.id === "number" ? m.id : Number.NaN))
                .filter((n) => Number.isInteger(n)) as number[];

            if (numericIds.length > 0) {
                await markCounselorMessagesAsRead(numericIds);
            }

            setMessages((prev) => prev.map((m) => (m.conversationId === activeConversationId ? { ...m, isUnread: false } : m)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark messages as read.");
        } finally {
            setIsMarking(false);
        }
    };

    const markSingleRead = async (msg: UiMessage) => {
        if (!msg.isUnread) return;

        if (typeof msg.id !== "number") {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)));
            return;
        }

        try {
            await markCounselorMessageReadByIdApi(msg.id);
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark message as read.");
        }
    };

    const startNewConversation = () => {
        if (!newRecipient) {
            toast.error("Recipient is required.");
            return;
        }

        const peerId = newRecipient.id;
        const peerName = newRecipient.name;

        const conversationId = `new-${newRecipient.role}-${String(peerId)}-${Date.now()}`;
        const subtitle =
            newRecipient.role === "counselor"
                ? "Counselor thread"
                : newRecipient.role === "guest"
                    ? "Guest thread"
                    : newRecipient.role === "admin"
                        ? "Admin thread"
                        : "Student thread";
        const nowIso = new Date().toISOString();

        const convo: Conversation = {
            id: conversationId,
            peerRole: newRecipient.role,
            peerName,
            peerId,
            subtitle,
            unreadCount: 0,
            lastMessage: "",
            lastTimestamp: nowIso,
            peerAvatarUrl: newRecipient.avatar_url ?? null,
        };

        setDraftConversations((prev) => [convo, ...prev]);
        setActiveConversationId(conversationId);
        setMobileView("chat");
        setShowNewMessage(false);

        const k = peerKey(convo.peerRole, convo.peerId);
        if (k && convo.peerAvatarUrl) {
            avatarCacheRef.current.set(k, convo.peerAvatarUrl);
            setAvatarByPeerKey((prev) => ({ ...prev, [k]: convo.peerAvatarUrl! }));
        }

        setNewRecipient(null);
        setRecipientQuery("");
        setRecipientResults([]);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeConversation) {
            toast.error("Select a conversation first.");
            return;
        }

        const text = draft.trim();
        if (!text) return;

        if (!activeConversation.peerId) {
            toast.error("This conversation has no recipient id. Please refresh.");
            return;
        }

        const tempId = `local-${++localIdRef.current}`;
        const nowIso = new Date().toISOString();

        const optimistic: UiMessage = {
            id: tempId,
            conversationId: activeConversation.id,
            sender: "counselor",
            senderName: counselorName,
            content: text,
            createdAt: nowIso,
            isUnread: false,

            senderId: myUserId || null,
            recipientRole: activeConversation.peerRole,
            recipientId: activeConversation.peerId ?? null,
        };

        setMessages((prev) => [...prev, optimistic]);
        setDraft("");
        setIsSending(true);

        try {
            const payload: any = {
                content: text,
                conversation_id: activeConversation.id,
                recipient_role: activeConversation.peerRole,
                recipient_id: activeConversation.peerId,
            };

            const res = await sendCounselorMessage(payload);
            const dto = res.messageRecord;
            const serverMsg = dto ? mapDtoToUi(dto) : null;

            if (serverMsg) {
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m)));
                if (serverMsg.conversationId && serverMsg.conversationId !== activeConversation.id) {
                    setActiveConversationId(serverMsg.conversationId);
                }
            }

            setDraftConversations((prev) => prev.filter((c) => c.id !== activeConversation.id));
        } catch (err) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            toast.error(err instanceof Error ? err.message : "Failed to send message.");
        } finally {
            setIsSending(false);
        }
    };

    // ===== Edit / Delete message =====
    const isMine = (m: UiMessage) => m.sender === "counselor" && String(m.senderId ?? "") === myUserId;
    const canEdit = (m: UiMessage) => m.sender !== "system" && isMine(m);
    const canDelete = (m: UiMessage) => m.sender !== "system";

    const openEdit = (m: UiMessage) => {
        setEditingMessage(m);
        setEditDraft(m.content);
        setEditOpen(true);
    };

    const saveEdit = async () => {
        if (!editingMessage) return;
        const next = editDraft.trim();
        if (!next) {
            toast.error("Message cannot be empty.");
            return;
        }

        const id = editingMessage.id;
        const prevContent = editingMessage.content;

        setIsSavingEdit(true);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: next } : m)));

        try {
            if (typeof id === "number") {
                await tryUpdateMessageApi(id, next, token);
            }
            setEditOpen(false);
            setEditingMessage(null);
            toast.success("Message updated.");
        } catch (err) {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: prevContent } : m)));
            toast.error(err instanceof Error ? err.message : "Failed to update message.");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const askDeleteMessage = (m: UiMessage) => {
        setDeletingMessage(m);
        setDeleteMsgOpen(true);
    };

    const confirmDeleteMessage = async () => {
        if (!deletingMessage) return;

        const target = deletingMessage;
        setIsDeletingMsg(true);

        let removed: { msg: UiMessage; index: number } | null = null;

        setMessages((prev) => {
            const index = prev.findIndex((x) => x.id === target.id);
            removed = { msg: target, index: index < 0 ? prev.length : index };
            return prev.filter((x) => x.id !== target.id);
        });

        try {
            if (typeof target.id === "number") {
                await tryDeleteMessageApi(target.id, token);
            }
            toast.success("Message deleted.");
            setDeleteMsgOpen(false);
            setDeletingMessage(null);
        } catch (err) {
            if (removed) {
                setMessages((prev) => {
                    const next = [...prev];
                    const idx = Math.max(0, Math.min(removed!.index, next.length));
                    next.splice(idx, 0, removed!.msg);
                    return next;
                });
            }
            toast.error(err instanceof Error ? err.message : "Failed to delete message.");
        } finally {
            setIsDeletingMsg(false);
        }
    };

    // ===== Delete conversation =====
    const askDeleteConversation = () => {
        if (!activeConversation) return;
        setDeleteConvoOpen(true);
    };

    const confirmDeleteConversation = async () => {
        if (!activeConversation) return;

        const convoId = activeConversation.id;
        const toDelete = activeMessages;

        const nextCandidate = conversations.filter((c) => c.id !== convoId)[0]?.id ?? "";

        setIsDeletingConvo(true);

        const removedPayload = {
            messages: toDelete,
            draft: draftConversations.find((d) => d.id === convoId) ?? null,
        };

        setMessages((prev) => prev.filter((m) => m.conversationId !== convoId));
        setDraftConversations((prev) => prev.filter((d) => d.id !== convoId));

        try {
            await tryDeleteConversationApi(convoId, token);
            toast.success("Conversation deleted.");
            setDeleteConvoOpen(false);
            setActiveConversationId(nextCandidate);
            if (!nextCandidate) setMobileView("list");
        } catch (err) {
            setMessages((prev) => [...prev, ...removedPayload.messages]);
            if (removedPayload.draft) setDraftConversations((prev) => [removedPayload.draft!, ...prev]);
            toast.error(err instanceof Error ? err.message : "Failed to delete conversation.");
        } finally {
            setIsDeletingConvo(false);
        }
    };

    // ===== Avatar helpers per conversation =====
    const getConversationAvatarSrc = (c: Conversation): string | null => {
        const k = peerKey(c.peerRole, c.peerId);
        const raw = c.peerAvatarUrl ?? (k ? avatarByPeerKey[k] : null) ?? null;
        return resolveAvatarSrc(raw);
    };

    return (
        <DashboardLayout title="Messages" description="Manage and respond to conversations.">
            <div className="mx-auto w-full px-4">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2 p-4 sm:p-6">
                        <CardTitle className="text-base">
                            <span className="sm:hidden">Inbox</span>
                            <span className="hidden sm:inline">Counselor Inbox</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            <span className="sm:hidden">Reply to threads and send new messages.</span>
                            <span className="hidden sm:inline">Create new messages and manage existing threads.</span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-[640px] grid-cols-1 md:min-h-[700px] md:grid-cols-[360px_1fr]">
                            {/* LEFT: conversations */}
                            <div className={`border-b md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
                                <div className="p-3 sm:p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-900">Inbox</div>
                                            <div className="truncate text-xs text-muted-foreground">{counselorName}</div>
                                        </div>

                                        <Badge variant="secondary" className="w-fit text-[0.70rem] sm:text-[0.70rem]">
                                            Counselor
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
                                                            const nextRole = v as PeerRole;
                                                            setNewRole(nextRole);
                                                            setNewRecipient(null);
                                                            setRecipientQuery("");
                                                            setRecipientResults([]);
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
                                                            setRecipientQuery(v);
                                                            setNewRecipient(null);
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
                                        <TabsList className="mt-3 flex w-full justify-start gap-1 overflow-x-auto whitespace-nowrap px-1 sm:grid sm:grid-cols-5 sm:px-0">
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
                                                const active = c.id === activeConversationId;
                                                const avatarSrc = getConversationAvatarSrc(c);

                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveConversationId(c.id);
                                                            setMobileView("chat");
                                                        }}
                                                        className={`w-full rounded-xl border p-2.5 text-left transition sm:p-3 ${active ? "bg-white shadow-sm" : "bg-white/60 hover:bg-white"}`}
                                                    >
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                                <Avatar className="h-8 w-8 border sm:h-9 sm:w-9">
                                                                    <AvatarImage
                                                                        src={avatarSrc ?? undefined}
                                                                        alt={c.peerName}
                                                                        className="object-cover"
                                                                        loading="lazy"
                                                                    />
                                                                    <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">
                                                                        {initials(c.peerName)}
                                                                    </AvatarFallback>
                                                                </Avatar>

                                                                <div className="min-w-0">
                                                                    <div className="truncate text-[0.92rem] font-semibold text-slate-900 sm:text-sm">
                                                                        {c.peerName}
                                                                    </div>
                                                                    <div className="truncate text-[0.72rem] text-muted-foreground sm:text-xs">{c.subtitle}</div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                                                                {c.unreadCount > 0 ? (
                                                                    <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">{c.unreadCount}</Badge>
                                                                ) : (
                                                                    <span />
                                                                )}
                                                                <span className="text-[0.72rem] text-muted-foreground sm:text-xs">{formatShort(c.lastTimestamp)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-2 line-clamp-2 text-[0.72rem] text-muted-foreground sm:truncate sm:text-xs">
                                                            {c.lastMessage || "No messages yet."}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* RIGHT: chat */}
                            <div className={`flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
                                <div className="flex flex-col gap-3 border-b bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <Button type="button" variant="outline" size="icon" className="md:hidden" onClick={() => setMobileView("list")} aria-label="Back">
                                            ←
                                        </Button>

                                        {activeConversation ? (
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <Avatar className="h-9 w-9 border sm:h-10 sm:w-10">
                                                    <AvatarImage
                                                        src={getConversationAvatarSrc(activeConversation) ?? undefined}
                                                        alt={activeConversation.peerName}
                                                        className="object-cover"
                                                        loading="lazy"
                                                    />
                                                    <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">
                                                        {initials(activeConversation.peerName)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">{activeConversation.peerName}</div>
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
                                                            e.preventDefault();
                                                            askDeleteConversation();
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
                                            className="h-10 w-full text-[0.85rem] sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
                                            onClick={markConversationRead}
                                            disabled={!activeConversation || isMarking}
                                        >
                                            {isMarking ? "Marking…" : "Mark read"}
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="h-[480px] bg-linear-to-b from-muted/30 to-white sm:h-[520px]">
                                    <div className="space-y-3 p-3 sm:p-4">
                                        {!activeConversation ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">Choose a conversation from the left.</div>
                                        ) : isLoading ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">Loading messages…</div>
                                        ) : activeMessages.length === 0 ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">No messages yet.</div>
                                        ) : (
                                            activeMessages.map((m) => {
                                                const mine = m.sender === "counselor" && String(m.senderId ?? "") === myUserId;
                                                const system = m.sender === "system";
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start";

                                                const bubble = system
                                                    ? "border bg-white/90"
                                                    : mine
                                                        ? "border-indigo-200 bg-indigo-50/90"
                                                        : "border-slate-200 bg-white/90";

                                                return (
                                                    <div key={m.id} className={`flex ${align}`}>
                                                        <div className="max-w-[94%] sm:max-w-[86%]">
                                                            {!system ? (
                                                                <div className={`mb-1 flex flex-wrap items-center gap-2 text-[0.70rem] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}>
                                                                    <span className="font-medium text-slate-700">{mine ? "You" : m.senderName}</span>
                                                                    <span aria-hidden="true">•</span>

                                                                    <span className="sm:hidden">{formatTimeOnly(m.createdAt)}</span>
                                                                    <span className="hidden sm:inline">{formatTimestamp(m.createdAt)}</span>

                                                                    {m.isUnread ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => markSingleRead(m)}
                                                                            className="rounded-full bg-amber-100 px-2 py-px text-[0.65rem] font-semibold text-amber-900 hover:bg-amber-200"
                                                                        >
                                                                            NEW
                                                                        </button>
                                                                    ) : null}

                                                                    {(canEdit(m) || canDelete(m)) && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-6 sm:w-6">
                                                                                    <MoreVertical className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align={mine ? "end" : "start"}>
                                                                                {canEdit(m) && (
                                                                                    <DropdownMenuItem
                                                                                        onSelect={(e) => {
                                                                                            e.preventDefault();
                                                                                            openEdit(m);
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
                                                                                            e.preventDefault();
                                                                                            askDeleteMessage(m);
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
                                                            ) : (
                                                                <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">
                                                                    <span className="sm:hidden">{formatTimeOnly(m.createdAt)}</span>
                                                                    <span className="hidden sm:inline">{formatTimestamp(m.createdAt)}</span>
                                                                </div>
                                                            )}

                                                            <div className={`rounded-2xl border px-3 py-2 text-[0.90rem] leading-relaxed shadow-sm sm:text-sm ${bubble}`}>
                                                                {m.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
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
                            <DialogDescription>Update your message then save.</DialogDescription>
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
                            <AlertDialogAction onClick={confirmDeleteMessage} disabled={isDeletingMsg} className="bg-destructive text-white hover:bg-destructive/90">
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
                            <AlertDialogDescription>This will remove the entire thread (all messages) from your inbox.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingConvo}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteConversation} disabled={isDeletingConvo} className="bg-destructive text-white hover:bg-destructive/90">
                                {isDeletingConvo ? "Deleting…" : "Delete conversation"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
};

export default CounselorMessages;
