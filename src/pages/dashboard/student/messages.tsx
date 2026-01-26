/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/authentication";

import {
    fetchStudentMessages,
    sendStudentMessage,
    markStudentMessagesAsRead,
    type StudentMessage,
} from "@/lib/messages";
import { markStudentMessageReadByIdApi } from "@/api/messages/[id]/route";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
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

type UiSender = "student" | "guest" | "counselor" | "system";

type UiMessage = {
    id: number | string;
    conversationId: string;

    sender: UiSender;
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
    counselorId?: number | string | null;
    counselorName: string;
    subtitle: string;
    unreadCount: number;
    lastMessage?: string;
    lastTimestamp?: string;
};

type DirectoryCounselor = {
    id: number | string;
    name: string;
    avatarUrl?: string | null;
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
        (u?.display_name && String(u.display_name).trim()) ||
        (u?.first_name || u?.last_name ? `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() : "") ||
        "";
    return name || "Counselor";
}

function extractUserAvatarUrl(u: any): string | null {
    const raw =
        u?.avatar_url ??
        u?.avatarUrl ??
        u?.avatar ??
        u?.profile_photo_url ??
        u?.profilePhotoUrl ??
        null;

    if (raw == null) return null;

    const s = String(raw).trim();
    return s ? s : null;
}

// ✅ FIXED: TypeScript boolean type is `boolean` (not `bool`)
function looksLikeFilePath(s: string): boolean {
    return (
        /\.[a-z0-9]{2,5}(\?.*)?$/i.test(s) ||
        /(^|\/)(avatars|avatar|profile|profiles|images|uploads)(\/|$)/i.test(s)
    );
}

/**
 * Resolve avatar URLs so AvatarImage can actually load them:
 * - keeps absolute urls (http/https, data:, blob:)
 * - prefixes relative paths using the API origin
 * - auto-prefixes "storage/" when the value looks like a file path
 */
function resolveAvatarSrc(raw?: string | null): string | undefined {
    if (!raw) return undefined;

    let s = String(raw).trim();
    if (!s) return undefined;

    s = s.replace(/\\/g, "/");

    if (/^(data:|blob:)/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("//")) {
        const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
        return `${protocol}${s}`;
    }

    // If we don't have an API base, at least return a root-relative path.
    if (!API_BASE_URL) {
        if (!s.startsWith("/")) s = `/${s}`;
        return s;
    }

    let origin = API_BASE_URL;
    try {
        origin = new URL(API_BASE_URL).origin;
    } catch {
        // keep as-is
    }

    // Normalize to a clean path segment (no leading slash)
    let p = s.replace(/^\/+/, "");
    const lower = p.toLowerCase();

    const alreadyStorage = lower.startsWith("storage/") || lower.startsWith("api/storage/");
    // ✅ FIXED: no weird casting needed; looksLikeFilePath already returns boolean
    if (!alreadyStorage && looksLikeFilePath(p)) {
        p = `storage/${p}`;
    }

    return `${origin}/${p}`;
}

/**
 * ✅ MODIFIED:
 * Try role-specific counselor directory endpoints FIRST (/counselors),
 * then fallback to generic /users?role=counselor.
 */
async function trySearchCounselorsFromDb(query: string, token?: string | null): Promise<DirectoryCounselor[]> {
    const q = query.trim();
    const roleParam = encodeURIComponent("counselor");

    const candidates: string[] = [];
    if (q.length > 0) {
        const qq = encodeURIComponent(q);

        // ✅ counselor collection endpoints first
        candidates.push(`/counselors?search=${qq}`);
        candidates.push(`/counselors/search?q=${qq}`);
        candidates.push(`/counselors?query=${qq}`);
        candidates.push(`/counselors?q=${qq}`);

        // fallback to generic users endpoints
        candidates.push(`/users?role=${roleParam}&search=${qq}`);
        candidates.push(`/users?role=${roleParam}&q=${qq}`);
        candidates.push(`/users/search?role=${roleParam}&q=${qq}`);
        candidates.push(`/search/users?role=${roleParam}&q=${qq}`);
    } else {
        // ✅ counselor collection endpoints first
        candidates.push(`/counselors?limit=20`);
        candidates.push(`/counselors?per_page=20`);

        // fallback to generic users endpoints
        candidates.push(`/users?role=${roleParam}&limit=20`);
        candidates.push(`/users?role=${roleParam}&per_page=20`);
    }

    let lastErr: any = null;

    for (const path of candidates) {
        try {
            const data = await apiFetch(path, { method: "GET" }, token);
            const arr = extractUsersArray(data);

            const mapped: DirectoryCounselor[] = arr
                .map((raw) => raw?.user ?? raw)
                .map((u: any) => {
                    const id = u?.id ?? u?.user_id ?? u?.counselor_id;
                    if (id == null || String(id).trim() === "") return null;

                    const name = extractUserName(u);
                    const avatarUrl = resolveAvatarSrc(extractUserAvatarUrl(u)) ?? null;

                    return { id, name, avatarUrl } as DirectoryCounselor;
                })
                .filter(Boolean) as DirectoryCounselor[];

            // de-dupe
            const seen = new Set<string>();
            const deduped = mapped.filter((c) => {
                const key = String(c.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return deduped;
        } catch (e) {
            lastErr = e;
        }
    }

    throw lastErr ?? new Error("Failed to search counselors from database.");
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

function normalizeSender(sender: StudentMessage["sender"]): UiSender {
    if (sender === "student" || sender === "guest" || sender === "counselor" || sender === "system") return sender;
    return "system";
}

function safeConversationIdStudent(dto: StudentMessage): string {
    const raw = (dto as any).conversation_id ?? (dto as any).conversationId;
    if (raw != null && String(raw).trim()) return String(raw);

    const sender = normalizeSender(dto.sender);
    const senderId = (dto as any).sender_id ?? null;

    const recipientRole = (dto as any).recipient_role ?? null;
    const recipientId = (dto as any).recipient_id ?? null;

    const counselorId =
        (sender === "counselor" ? senderId : null) ??
        (recipientRole === "counselor" ? recipientId : null) ??
        (dto as any).counselor_id ??
        null;

    if (counselorId != null && String(counselorId).trim()) return `counselor-${String(counselorId)}`;
    return "counselor-office";
}

function mapDtoToUi(dto: StudentMessage, meName: string, index: number): UiMessage {
    const sender = normalizeSender(dto.sender);

    const senderName =
        (dto.sender_name && String(dto.sender_name).trim()) ||
        (sender === "system" ? "Guidance & Counseling Office" : sender === "counselor" ? "Counselor" : meName);

    const createdAt = dto.created_at ?? new Date(0).toISOString();
    const fallbackId = `${createdAt}-${sender}-${index}`;

    return {
        id: dto.id ?? fallbackId,
        conversationId: safeConversationIdStudent(dto),

        sender,
        senderName,
        content: dto.content ?? "",
        createdAt,
        isUnread: dto.is_read === false || dto.is_read === 0,

        senderId: (dto as any).sender_id ?? null,
        recipientId: (dto as any).recipient_id ?? null,
        recipientRole: (dto as any).recipient_role ?? null,
        userId: (dto as any).user_id ?? null,
    };
}

function buildConversations(messages: UiMessage[]): Conversation[] {
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

        const counselorMsg = ordered.find((m) => m.sender === "counselor") ?? null;

        const counselorId =
            counselorMsg?.senderId ??
            ordered.find((m) => m.recipientRole === "counselor" && m.recipientId != null)?.recipientId ??
            (conversationId.startsWith("counselor-") ? conversationId.replace("counselor-", "") : null);

        const counselorName =
            (counselorMsg?.senderName && counselorMsg.senderName !== "Counselor" ? counselorMsg.senderName : "") ||
            (counselorId != null ? `Counselor #${counselorId}` : "Counselor Office");

        conversations.push({
            id: conversationId,
            counselorId: counselorId ?? null,
            counselorName,
            subtitle: "Private thread",
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

function CounselorCombobox(props: {
    counselors: DirectoryCounselor[];
    value: DirectoryCounselor | null;
    onChange: (u: DirectoryCounselor) => void;

    searchValue: string;
    onSearchValueChange: (v: string) => void;
    isLoading?: boolean;

    placeholder?: string;
    emptyText?: string;
}) {
    const {
        counselors,
        value,
        onChange,
        searchValue,
        onSearchValueChange,
        isLoading,
        placeholder = "Select counselor…",
        emptyText = "No counselors found.",
    } = props;

    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 w-full justify-between sm:h-9"
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
                        placeholder="Type counselor name or ID…"
                        value={searchValue}
                        onValueChange={(v) => onSearchValueChange(v)}
                    />
                    <CommandList>
                        <CommandEmpty>{isLoading ? "Searching…" : emptyText}</CommandEmpty>
                        <CommandGroup>
                            {counselors.map((u) => {
                                const selected = !!value && String(value.id) === String(u.id);
                                return (
                                    <CommandItem
                                        key={`counselor-${u.id}`}
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
                                            <div className="truncate text-xs text-muted-foreground">ID: {u.id}</div>
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

const StudentMessages: React.FC = () => {
    const session = getCurrentSession();
    const token = (session as any)?.token ?? null;
    const meName = session?.user && (session.user as any).name ? String((session.user as any).name) : "You";
    const myUserId = session?.user?.id != null ? String(session.user.id) : "";

    const [mobileView, setMobileView] = React.useState<"list" | "chat">("list");

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSending, setIsSending] = React.useState(false);
    const [isMarking, setIsMarking] = React.useState(false);

    const [search, setSearch] = React.useState("");

    const [draft, setDraft] = React.useState("");
    const [messages, setMessages] = React.useState<UiMessage[]>([]);
    const [activeConversationId, setActiveConversationId] = React.useState<string>("");

    const [draftConversations, setDraftConversations] = React.useState<Conversation[]>([]);
    const [showNewMessage, setShowNewMessage] = React.useState(false);

    // NEW: counselor directory fetched from DB (not history)
    const [newCounselor, setNewCounselor] = React.useState<DirectoryCounselor | null>(null);
    const [counselorQuery, setCounselorQuery] = React.useState("");
    const [counselorResults, setCounselorResults] = React.useState<DirectoryCounselor[]>([]);
    const [counselorLoading, setCounselorLoading] = React.useState(false);

    // ✅ NEW: cache counselor profiles so avatars can render (id -> counselor)
    const [counselorById, setCounselorById] = React.useState<Record<string, DirectoryCounselor>>({});
    const counselorByIdRef = React.useRef<Record<string, DirectoryCounselor>>({});

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

    const bottomRef = React.useRef<HTMLDivElement | null>(null);
    const localIdRef = React.useRef(0);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // keep refresh stable without re-fetching on convo change
    const activeConversationIdRef = React.useRef<string>("");
    const draftConversationsRef = React.useRef<Conversation[]>([]);

    React.useEffect(() => {
        counselorByIdRef.current = counselorById;
    }, [counselorById]);

    React.useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    React.useEffect(() => {
        draftConversationsRef.current = draftConversations;
    }, [draftConversations]);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversationId, messages.length]);

    const refreshMessages = React.useCallback(
        async (isMounted?: () => boolean) => {
            setIsLoading(true);
            try {
                const res = await fetchStudentMessages();
                const raw = Array.isArray(res.messages) ? res.messages : [];
                const ui = raw.map((m, idx) => mapDtoToUi(m, meName, idx));

                if (isMounted && !isMounted()) return;

                setMessages(ui);

                const convs = buildConversations(ui);

                const currentActive = activeConversationIdRef.current;
                const currentDrafts = draftConversationsRef.current;

                const existsInMessages = !!currentActive && convs.some((c) => c.id === currentActive);
                const existsInDrafts = !!currentActive && currentDrafts.some((d) => d.id === currentActive);

                const nextActive =
                    currentActive && (existsInMessages || existsInDrafts)
                        ? currentActive
                        : convs[0]?.id ?? currentDrafts[0]?.id ?? "";

                if (nextActive !== currentActive) {
                    setActiveConversationId(nextActive);
                    if (!nextActive) setMobileView("list");
                }
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to load your messages.");
            } finally {
                if (!isMounted || isMounted()) setIsLoading(false);
            }
        },
        [meName],
    );

    React.useEffect(() => {
        let mounted = true;
        refreshMessages(() => mounted);
        return () => {
            mounted = false;
        };
    }, [refreshMessages]);

    // Fetch counselors from DB (debounced) when creating new message
    React.useEffect(() => {
        if (!showNewMessage) return;

        let cancelled = false;
        const q = counselorQuery.trim();
        const shouldFetch = q.length === 0 || q.length >= 2;

        if (!shouldFetch) {
            setCounselorResults([]);
            setCounselorLoading(false);
            return;
        }

        const t = window.setTimeout(async () => {
            setCounselorLoading(true);
            try {
                const res = await trySearchCounselorsFromDb(q, token);
                if (cancelled) return;
                setCounselorResults(res);

                // ✅ seed cache so avatars render immediately for selected counselor
                setCounselorById((prev) => {
                    const next = { ...prev };
                    for (const c of res) next[String(c.id)] = c;
                    return next;
                });
            } catch (err) {
                if (cancelled) return;
                setCounselorResults([]);
                toast.error(err instanceof Error ? err.message : "Failed to search counselors.");
            } finally {
                if (!cancelled) setCounselorLoading(false);
            }
        }, q.length === 0 ? 0 : 300);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [showNewMessage, counselorQuery, token]);

    const conversationsFromMessages = React.useMemo(() => buildConversations(messages), [messages]);

    // ✅ Load counselor profiles (name + avatar) for conversations so AvatarImage can render
    React.useEffect(() => {
        let cancelled = false;

        const ids = Array.from(
            new Set(
                conversationsFromMessages
                    .map((c) => (c.counselorId != null ? String(c.counselorId).trim() : ""))
                    .filter((id) => id !== "" && /^\d+$/.test(id)),
            ),
        );

        const missing = ids.filter((id) => counselorByIdRef.current[id] == null);
        if (missing.length === 0) return;

        (async () => {
            try {
                // Fetch individually (robust across varying backend endpoints)
                const found: Record<string, DirectoryCounselor> = {};

                for (const id of missing) {
                    if (cancelled) return;

                    try {
                        const res = await trySearchCounselorsFromDb(id, token);
                        const exact = res.find((c) => String(c.id) === id) ?? res[0] ?? null;

                        if (exact) found[id] = exact;
                    } catch {
                        // ignore per-id failure; fallback will stay initials
                    }
                }

                if (cancelled) return;

                if (Object.keys(found).length > 0) {
                    setCounselorById((prev) => ({ ...prev, ...found }));
                }
            } catch {
                // ignore
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [conversationsFromMessages, token]);

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
        if (!q) return conversations;
        return conversations.filter(
            (c) => c.counselorName.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
        );
    }, [conversations, search]);

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

    const hasUnreadActive = React.useMemo(() => activeMessages.some((m) => m.isUnread), [activeMessages]);

    const markConversationRead = async () => {
        if (!activeConversationId) return;
        const unread = activeMessages.filter((m) => m.isUnread);
        if (unread.length === 0) return;

        setIsMarking(true);
        try {
            const numericIds = unread
                .map((m) => (typeof m.id === "number" ? m.id : Number.NaN))
                .filter((n) => Number.isInteger(n)) as number[];

            try {
                if (numericIds.length > 0) {
                    await (markStudentMessagesAsRead as any)(numericIds);
                } else {
                    await markStudentMessagesAsRead();
                }
            } catch {
                await markStudentMessagesAsRead();
            }

            setMessages((prev) =>
                prev.map((m) =>
                    m.conversationId === activeConversationId ? { ...m, isUnread: false } : m,
                ),
            );
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark messages as read.");
        } finally {
            setIsMarking(false);
        }
    };

    const markSingleAsRead = async (msg: UiMessage) => {
        if (!msg.isUnread) return;

        if (typeof msg.id !== "number") {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)));
            return;
        }

        try {
            await markStudentMessageReadByIdApi(msg.id);
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark message as read.");
        }
    };

    const startNewConversation = () => {
        if (!newCounselor) {
            toast.error("Counselor is required.");
            return;
        }

        const counselorId = newCounselor.id;
        const counselorName = newCounselor.name;
        const conversationId = `new-counselor-${String(counselorId)}-${Date.now()}`;
        const nowIso = new Date().toISOString();

        const convo: Conversation = {
            id: conversationId,
            counselorId,
            counselorName,
            subtitle: "Private thread",
            unreadCount: 0,
            lastMessage: "",
            lastTimestamp: nowIso,
        };

        setDraftConversations((prev) => [convo, ...prev]);
        setActiveConversationId(conversationId);
        setMobileView("chat");
        setShowNewMessage(false);

        // ✅ seed cache for avatar immediately
        setCounselorById((prev) => ({ ...prev, [String(newCounselor.id)]: newCounselor }));

        setNewCounselor(null);
        setCounselorQuery("");
        setCounselorResults([]);

        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeConversation) {
            toast.error("Select a counselor conversation first.");
            return;
        }

        const text = draft.trim();
        if (!text) return;

        const counselorId = activeConversation.counselorId ?? null;
        if (!counselorId) {
            toast.error("This conversation has no counselor id. Please create/select a counselor conversation.");
            return;
        }

        const tempId = `local-${++localIdRef.current}`;
        const nowIso = new Date().toISOString();

        const optimistic: UiMessage = {
            id: tempId,
            conversationId: activeConversation.id,
            sender: "student",
            senderName: meName,
            content: text,
            createdAt: nowIso,
            isUnread: false,

            senderId: myUserId || null,
            userId: myUserId || null,
            recipientRole: "counselor",
            recipientId: counselorId,
        };

        setMessages((prev) => [...prev, optimistic]);
        setDraft("");
        setIsSending(true);

        try {
            const payload: any = {
                content: text,
                recipient_role: "counselor",
                recipient_id: counselorId,
                conversation_id: activeConversation.id,
            };

            const res = await (sendStudentMessage as any)(payload);
            const dto = res?.messageRecord ?? null;

            if (dto) {
                const serverMsg = mapDtoToUi(dto, meName, messages.length);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m)));

                if (serverMsg.conversationId && serverMsg.conversationId !== activeConversation.id) {
                    setActiveConversationId(serverMsg.conversationId);
                }
            }

            setDraftConversations((prev) => prev.filter((c) => c.id !== activeConversation.id));
        } catch (err) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            toast.error(err instanceof Error ? err.message : "Failed to send your message.");
        } finally {
            setIsSending(false);
        }
    };

    // ===== Edit / Delete message (student can only edit/delete their own student/guest messages) =====
    const isMineMessage = (m: UiMessage) => {
        if (!(m.sender === "student" || m.sender === "guest")) return false;
        if (!myUserId) return true; // fallback: keep behavior if id missing
        const sid = m.senderId != null ? String(m.senderId) : "";
        const uid = m.userId != null ? String(m.userId) : "";
        return sid === myUserId || uid === myUserId;
    };

    const canEdit = (m: UiMessage) => isMineMessage(m);
    const canDelete = (m: UiMessage) => isMineMessage(m);

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

    const getCounselorUi = (c: Conversation | null) => {
        if (!c) return { name: "", avatarUrl: null as string | null };
        const idKey = c.counselorId != null ? String(c.counselorId).trim() : "";
        const cached = idKey ? counselorById[idKey] : null;
        return {
            name: cached?.name ?? c.counselorName,
            avatarUrl: cached?.avatarUrl ?? null,
        };
    };

    return (
        <DashboardLayout title="Messages" description="Chat privately with your chosen counselor.">
            <div className="mx-auto w-full px-4">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2 p-4 sm:p-6">
                        <CardTitle className="text-base">
                            <span className="sm:hidden">Inbox</span>
                            <span className="hidden sm:inline">Messages</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            <span className="sm:hidden">Pick a counselor and start chatting.</span>
                            <span className="hidden sm:inline">
                                Choose a counselor to message. Each counselor has their own private thread.
                            </span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-[640px] grid-cols-1 sm:min-h-[680px] md:grid-cols-[340px_1fr]">
                            {/* LEFT: conversation list */}
                            <div
                                className={`border-b md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"}`}
                            >
                                <div className="p-3 sm:p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="text-sm font-semibold text-slate-900">Conversations</div>

                                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 sm:h-8 sm:w-8"
                                                onClick={() => refreshMessages()}
                                                disabled={isLoading}
                                                aria-label="Refresh conversations"
                                                title="Refresh"
                                            >
                                                <RefreshCw className={cn("h-4 w-4", isLoading ? "animate-spin" : "")} />
                                            </Button>

                                            <Badge variant="secondary" className="w-fit text-[0.70rem]">
                                                Student
                                            </Badge>
                                        </div>
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
                                                    <Label className="text-[0.70rem] font-medium text-slate-700">
                                                        Counselor (required)
                                                    </Label>

                                                    <CounselorCombobox
                                                        counselors={counselorResults}
                                                        value={newCounselor}
                                                        onChange={(u) => setNewCounselor(u)}
                                                        searchValue={counselorQuery}
                                                        onSearchValueChange={(v) => {
                                                            setCounselorQuery(v);
                                                            setNewCounselor(null);
                                                        }}
                                                        isLoading={counselorLoading}
                                                        placeholder="Type counselor name or ID…"
                                                        emptyText={
                                                            counselorQuery.trim().length < 2
                                                                ? "Type at least 2 characters to search."
                                                                : "No counselors found."
                                                        }
                                                    />

                                                    <div className="text-[0.70rem] text-muted-foreground">
                                                        <span className="sm:hidden">Searches your database (not history).</span>
                                                        <span className="hidden sm:inline">
                                                            Tip: This searches your database (not message history).
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    className="mt-2 h-10 text-[0.85rem] sm:h-9 sm:text-xs"
                                                    onClick={startNewConversation}
                                                    disabled={!newCounselor}
                                                >
                                                    Start
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="mt-3">
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search counselors…"
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
                                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">
                                                No conversations found.
                                            </div>
                                        ) : (
                                            filteredConversations.map((c) => {
                                                const active = c.id === activeConversationId;
                                                const ui = getCounselorUi(c);

                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveConversationId(c.id);
                                                            setMobileView("chat");
                                                            requestAnimationFrame(() => textareaRef.current?.focus());
                                                        }}
                                                        className={`w-full rounded-xl border p-2.5 text-left transition sm:p-3 ${active ? "bg-white shadow-sm" : "bg-white/60 hover:bg-white"
                                                            }`}
                                                    >
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                                <Avatar className="h-8 w-8 border sm:h-9 sm:w-9">
                                                                    {ui.avatarUrl ? (
                                                                        <AvatarImage
                                                                            src={ui.avatarUrl}
                                                                            alt={ui.name}
                                                                            loading="lazy"
                                                                        />
                                                                    ) : null}
                                                                    <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">
                                                                        {initials(ui.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>

                                                                <div className="min-w-0">
                                                                    <div className="truncate text-[0.92rem] font-semibold text-slate-900 sm:text-sm">
                                                                        {ui.name}
                                                                    </div>
                                                                    <div className="truncate text-[0.72rem] text-muted-foreground sm:text-xs">
                                                                        {c.subtitle}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                                                                {c.unreadCount > 0 ? (
                                                                    <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">
                                                                        {c.unreadCount}
                                                                    </Badge>
                                                                ) : (
                                                                    <span />
                                                                )}
                                                                <span className="text-[0.72rem] text-muted-foreground sm:text-xs">
                                                                    {formatShort(c.lastTimestamp)}
                                                                </span>
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
                                                {(() => {
                                                    const ui = getCounselorUi(activeConversation);
                                                    return (
                                                        <>
                                                            <Avatar className="h-9 w-9 border sm:h-10 sm:w-10">
                                                                {ui.avatarUrl ? (
                                                                    <AvatarImage
                                                                        src={ui.avatarUrl}
                                                                        alt={ui.name}
                                                                        loading="lazy"
                                                                    />
                                                                ) : null}
                                                                <AvatarFallback className="text-[0.70rem] font-semibold sm:text-xs">
                                                                    {initials(ui.name)}
                                                                </AvatarFallback>
                                                            </Avatar>

                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-semibold text-slate-900">
                                                                    {ui.name}
                                                                </div>
                                                                <div className="truncate text-[0.72rem] text-muted-foreground sm:text-xs">
                                                                    Private thread
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">Select a counselor</div>
                                        )}
                                    </div>

                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 sm:h-9 sm:w-9"
                                                onClick={() => refreshMessages()}
                                                disabled={isLoading}
                                                aria-label="Refresh messages"
                                                title="Refresh"
                                            >
                                                <RefreshCw className={cn("h-4 w-4", isLoading ? "animate-spin" : "")} />
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
                                            disabled={isLoading || isMarking || !activeConversation || !hasUnreadActive}
                                        >
                                            {isMarking ? "Marking…" : "Mark read"}
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="h-[480px] bg-linear-to-b from-muted/30 to-white sm:h-[520px]">
                                    <div className="space-y-3 p-3 sm:p-4">
                                        {!activeConversation ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">
                                                Choose a counselor conversation.
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
                                                const system = m.sender === "system";
                                                const mine = !system && isMineMessage(m);
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start";

                                                const bubble = system
                                                    ? "border bg-white/90"
                                                    : mine
                                                        ? "border-emerald-200 bg-emerald-50/90"
                                                        : "border-slate-200 bg-white/90";

                                                return (
                                                    <div key={m.id} className={`flex ${align}`}>
                                                        <div className="max-w-[94%] sm:max-w-[86%]">
                                                            {!system ? (
                                                                <div
                                                                    className={`mb-1 flex flex-wrap items-center gap-2 text-[0.70rem] text-muted-foreground ${mine ? "justify-end" : "justify-start"
                                                                        }`}
                                                                >
                                                                    <span className="font-medium text-slate-700">
                                                                        {mine ? "You" : m.senderName}
                                                                    </span>
                                                                    <span aria-hidden="true">•</span>

                                                                    <span className="sm:hidden">{formatTimeOnly(m.createdAt)}</span>
                                                                    <span className="hidden sm:inline">{formatTimestamp(m.createdAt)}</span>

                                                                    {m.isUnread ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => markSingleAsRead(m)}
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
                                                ref={textareaRef}
                                                value={draft}
                                                onChange={(e) => setDraft(e.target.value)}
                                                placeholder={
                                                    activeConversation
                                                        ? `Message ${getCounselorUi(activeConversation).name}…`
                                                        : "Select a counselor…"
                                                }
                                                disabled={!activeConversation || isSending}
                                                className="min-h-12 resize-none rounded-2xl sm:min-h-11"
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
            </div>
        </DashboardLayout>
    );
};

export default StudentMessages;
