/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Check, ChevronsUpDown, MoreVertical, Pencil, Trash2 } from "lucide-react";

type PeerRole = "student" | "guest" | "counselor";

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
    recipientRole?: string | null;
    userId?: number | string | null;
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
};

type DirectoryUser = {
    id: number | string;
    name: string;
    role: PeerRole;
};

const RAW_BASE_URL = import.meta.env.VITE_API_LARAVEL_BASE_URL as string | undefined;
const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, "") : undefined;

function resolveApiUrl(path: string): string {
    if (!API_BASE_URL) throw new Error("VITE_API_LARAVEL_BASE_URL is not defined.");
    const trimmed = path.replace(/^\/+/, "");
    return `${API_BASE_URL}/${trimmed}`;
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

async function tryDeleteConversationApi(conversationId: string, numericMessageIds: number[], token?: string | null) {
    const candidates = [
        `/messages/conversations/${encodeURIComponent(conversationId)}`,
        `/conversations/${encodeURIComponent(conversationId)}`,
        `/messages/thread/${encodeURIComponent(conversationId)}`,
    ];

    for (const p of candidates) {
        try {
            await apiFetch(p, { method: "DELETE" }, token);
            return;
        } catch {
            // ignore and fallback
        }
    }

    // fallback: delete each message
    for (const id of numericMessageIds) {
        try {
            await tryDeleteMessageApi(id, token);
        } catch {
            // keep going
        }
    }
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
 * Use DB role fields if present. Returns null when it can't confidently map.
 * (We use this to filter results to the selected role, if the API returns mixed roles.)
 */
function toPeerRole(role: any): PeerRole | null {
    if (role == null) return null;
    const r = String(role).trim().toLowerCase();

    if (r === "student") return "student";
    if (r === "guest") return "guest";
    if (r === "counselor") return "counselor";

    // common alternates
    if (r === "guidance" || r === "guidance_counselor" || r === "guidance counselor") return "counselor";
    if (r === "students") return "student";
    if (r === "guests") return "guest";
    if (r === "counselors") return "counselor";

    return null;
}

/**
 * Fetch users from DB (NOT from message history).
 *
 * IMPORTANT:
 * Since your exact Laravel endpoint is unknown from the frontend code shown,
 * this function tries several common routes + response shapes.
 * Adjust/lock to your real endpoint when you confirm it.
 */
async function trySearchUsersFromDb(role: PeerRole, query: string, token?: string | null): Promise<DirectoryUser[]> {
    const q = query.trim();
    const roleParam = encodeURIComponent(role);

    // Candidate endpoints (common Laravel patterns)
    const candidates: string[] = [];

    if (q.length > 0) {
        const qq = encodeURIComponent(q);
        candidates.push(`/users?role=${roleParam}&search=${qq}`);
        candidates.push(`/users?role=${roleParam}&q=${qq}`);
        candidates.push(`/users/search?role=${roleParam}&q=${qq}`);
        candidates.push(`/search/users?role=${roleParam}&q=${qq}`);

        // role-specific collections
        candidates.push(`/${role}s?search=${qq}`); // /students, /guests, /counselors
        candidates.push(`/${role}s/search?q=${qq}`);
        candidates.push(`/${role}s?query=${qq}`);
    } else {
        // "initial list" when nothing typed (try to keep small)
        candidates.push(`/users?role=${roleParam}&limit=20`);
        candidates.push(`/users?role=${roleParam}&per_page=20`);
        candidates.push(`/${role}s?limit=20`);
        candidates.push(`/${role}s?per_page=20`);
    }

    let lastErr: any = null;

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET" }, token);
            const arr = extractUsersArray(data);
            if (!Array.isArray(arr)) continue;

            const mapped: DirectoryUser[] = arr
                .map((raw) => raw?.user ?? raw) // sometimes nested
                .map((u: any) => {
                    const id = u?.id ?? u?.user_id ?? u?.account_id ?? u?.student_id ?? u?.counselor_id;
                    if (id == null || String(id).trim() === "") return null;

                    const name = extractUserName(u);

                    // ✅ Use toPeerRole here (fixes unused var error)
                    const dbRole =
                        toPeerRole(u?.role) ??
                        toPeerRole(u?.role_name) ??
                        toPeerRole(u?.account_type) ??
                        toPeerRole(u?.type);

                    // If API returns role info and it's not the selected role, skip it.
                    if (dbRole && dbRole !== role) return null;

                    return {
                        id,
                        name,
                        role: role,
                    } as DirectoryUser;
                })
                .filter(Boolean) as DirectoryUser[];

            // de-dupe
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

const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "MMM d, yyyy • h:mm a");
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

const roleLabel = (r: PeerRole) => (r === "counselor" ? "Counselor" : r === "guest" ? "Guest" : "Student");

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

    const recipientRole = (dto as any).recipient_role ?? null;
    const recipientId = (dto as any).recipient_id ?? null;

    const userId = (dto as any).user_id ?? dto.user_id ?? null;

    if ((sender === "student" || sender === "guest") && userId != null) return `${sender}-${userId}`;
    if ((recipientRole === "student" || recipientRole === "guest") && recipientId != null) return `${recipientRole}-${recipientId}`;
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
        recipientRole: (dto as any).recipient_role ?? null,
        userId: (dto as any).user_id ?? null,
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
            const rr = (peerMsg.recipientRole ?? "counselor") as PeerRole;
            peerRole = rr === "student" || rr === "guest" || rr === "counselor" ? rr : "counselor";
            peerId = peerMsg.recipientId ?? null;

            if (peerRole === "student" || peerRole === "guest") {
                peerName = peerId ? `${roleLabel(peerRole)} #${peerId}` : roleLabel(peerRole);
            } else {
                peerName = peerId ? `Counselor #${peerId}` : "Counselor Office";
            }
        }

        const subtitle =
            peerRole === "counselor" ? "Counselor thread" : peerRole === "guest" ? "Guest thread" : "Student thread";

        conversations.push({
            id: conversationId,
            peerRole,
            peerName,
            peerId,
            subtitle,
            unreadCount,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
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
                <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between">
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
    const session = getCurrentSession();
    const token = (session as any)?.token ?? null;
    const counselorName = session?.user && (session.user as any).name ? String((session.user as any).name) : "Counselor";
    const myUserId = session?.user?.id != null ? String(session.user.id) : "";

    const [isLoading, setIsLoading] = React.useState(true);
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
            setIsLoading(true);
            try {
                const res = await fetchCounselorMessages();
                const raw = Array.isArray(res.messages) ? res.messages : [];
                const ui = raw.map(mapDtoToUi);

                if (!mounted) return;

                setMessages(ui);

                const convs = buildConversations(ui, myUserId, counselorName);
                if (!activeConversationId && convs.length > 0) setActiveConversationId(convs[0].id);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to load counselor messages.");
            } finally {
                if (mounted) setIsLoading(false);
            }
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
        };

        setDraftConversations((prev) => [convo, ...prev]);
        setActiveConversationId(conversationId);
        setMobileView("chat");
        setShowNewMessage(false);

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
    const canDelete = (m: UiMessage) => m.sender !== "system"; // counselor can delete any non-system message

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
        const numericIds = toDelete
            .map((m) => (typeof m.id === "number" ? m.id : Number.NaN))
            .filter((n) => Number.isInteger(n)) as number[];

        const nextCandidate = conversations.filter((c) => c.id !== convoId)[0]?.id ?? "";

        setIsDeletingConvo(true);

        const removedPayload = {
            messages: toDelete,
            draft: draftConversations.find((d) => d.id === convoId) ?? null,
        };

        setMessages((prev) => prev.filter((m) => m.conversationId !== convoId));
        setDraftConversations((prev) => prev.filter((d) => d.id !== convoId));

        try {
            await tryDeleteConversationApi(convoId, numericIds, token);
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

    return (
        <DashboardLayout title="Messages" description="Manage and respond to conversations.">
            <div className="mx-auto w-full max-w-6xl">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-base">Counselor Inbox</CardTitle>
                        <CardDescription className="text-xs">Create new messages and manage existing threads.</CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-[700px] grid-cols-1 md:grid-cols-[360px_1fr]">
                            {/* LEFT: conversations */}
                            <div className={`border-b md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
                                <div className="p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-900">Inbox</div>
                                            <div className="truncate text-xs text-muted-foreground">{counselorName}</div>
                                        </div>
                                        <Badge variant="secondary" className="text-[0.70rem]">
                                            Counselor
                                        </Badge>
                                    </div>

                                    <Button type="button" variant="outline" className="h-9 w-full text-xs" onClick={() => setShowNewMessage((v) => !v)}>
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
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Select role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="student">Student</SelectItem>
                                                            <SelectItem value="guest">Guest</SelectItem>
                                                            <SelectItem value="counselor">Counselor</SelectItem>
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
                                                        Tip: This searches your database (not message history). If nothing appears, confirm your backend endpoint.
                                                    </div>
                                                </div>

                                                <Button type="button" className="mt-2 h-9 text-xs" onClick={startNewConversation} disabled={!newRecipient}>
                                                    Start
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <Tabs value={roleFilter} onValueChange={(v: any) => setRoleFilter(v as any)}>
                                        <TabsList className="mt-3 grid w-full grid-cols-4">
                                            <TabsTrigger value="all" className="text-xs">
                                                All
                                            </TabsTrigger>
                                            <TabsTrigger value="student" className="text-xs">
                                                Student
                                            </TabsTrigger>
                                            <TabsTrigger value="guest" className="text-xs">
                                                Guest
                                            </TabsTrigger>
                                            <TabsTrigger value="counselor" className="text-xs">
                                                Counselor
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="mt-3">
                                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="h-9" />
                                    </div>
                                </div>

                                <Separator />

                                <ScrollArea className="h-[560px]">
                                    <div className="space-y-2 p-4">
                                        {isLoading ? (
                                            <div className="text-sm text-muted-foreground">Loading conversations…</div>
                                        ) : filteredConversations.length === 0 ? (
                                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">No conversations found.</div>
                                        ) : (
                                            filteredConversations.map((c) => {
                                                const active = c.id === activeConversationId;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveConversationId(c.id);
                                                            setMobileView("chat");
                                                        }}
                                                        className={`w-full rounded-xl border p-3 text-left transition ${active ? "bg-white shadow-sm" : "bg-white/60 hover:bg-white"
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <Avatar className="h-9 w-9 border">
                                                                    <AvatarFallback className="text-xs font-semibold">{initials(c.peerName)}</AvatarFallback>
                                                                </Avatar>

                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-slate-900">{c.peerName}</div>
                                                                    <div className="truncate text-xs text-muted-foreground">{c.subtitle}</div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {c.unreadCount > 0 ? (
                                                                    <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">{c.unreadCount}</Badge>
                                                                ) : null}
                                                                <span className="text-xs text-muted-foreground">{formatShort(c.lastTimestamp)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-2 truncate text-xs text-muted-foreground">{c.lastMessage || "No messages yet."}</div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* RIGHT: chat */}
                            <div className={`flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
                                <div className="flex items-center justify-between gap-3 border-b bg-white/70 p-4">
                                    <div className="flex items-center gap-3">
                                        <Button type="button" variant="outline" size="icon" className="md:hidden" onClick={() => setMobileView("list")} aria-label="Back">
                                            ←
                                        </Button>

                                        {activeConversation ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border">
                                                    <AvatarFallback className="text-xs font-semibold">{initials(activeConversation.peerName)}</AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">{activeConversation.peerName}</div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {roleLabel(activeConversation.peerRole)} • {activeConversation.subtitle}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">Select a conversation</div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={markConversationRead} disabled={!activeConversation || isMarking}>
                                            {isMarking ? "Marking…" : "Mark read"}
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled={!activeConversation}>
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
                                </div>

                                <ScrollArea className="h-[520px] bg-linear-to-b from-muted/30 to-white">
                                    <div className="space-y-3 p-4">
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
                                                        <div className="max-w-[86%]">
                                                            {!system ? (
                                                                <div className={`mb-1 flex items-center gap-2 text-[0.70rem] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}>
                                                                    <span className="font-medium text-slate-700">{mine ? "You" : m.senderName}</span>
                                                                    <span aria-hidden="true">•</span>
                                                                    <span>{formatTimestamp(m.createdAt)}</span>

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
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
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
                                                                <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">{formatTimestamp(m.createdAt)}</div>
                                                            )}

                                                            <div className={`rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${bubble}`}>{m.content}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}

                                        <div ref={bottomRef} />
                                    </div>
                                </ScrollArea>

                                <form onSubmit={handleSend} className="border-t bg-white/80 p-4">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <Textarea
                                                value={draft}
                                                onChange={(e) => setDraft(e.target.value)}
                                                placeholder={activeConversation ? `Message ${activeConversation.peerName}…` : "Select a conversation…"}
                                                disabled={!activeConversation || isSending}
                                                className="min-h-11 resize-none rounded-2xl"
                                            />
                                        </div>

                                        <Button type="submit" className="h-11 rounded-2xl px-5" disabled={!activeConversation || isSending || !draft.trim()}>
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
