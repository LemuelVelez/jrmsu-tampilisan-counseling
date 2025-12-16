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

type PeerRole = "student" | "guest" | "counselor";

type UiMessage = {
    id: number | string;
    conversationId: string;

    sender: "student" | "guest" | "counselor" | "system";
    senderName: string;
    content: string;
    createdAt: string;

    // read flag in counselor context (backend aliases counselor_is_read -> is_read)
    isUnread: boolean;

    // extra (backend-dependent)
    senderId?: number | string | null;
    recipientId?: number | string | null;
    recipientRole?: string | null;
    userId?: number | string | null;
};

type Conversation = {
    id: string; // conversationId
    peerRole: PeerRole;
    peerName: string;
    peerId?: number | string | null;

    subtitle: string;
    unreadCount: number;
    lastMessage?: string;
    lastTimestamp?: string;
};

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
    if (dto.conversation_id != null && String(dto.conversation_id).trim()) return String(dto.conversation_id);

    // fallback: student threads typically have user_id
    if (dto.user_id != null) return `student-${dto.user_id}`;

    // fallback for anything else
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
            // stable fallback
            return String(a.id).localeCompare(String(b.id));
        });

        const last = ordered[ordered.length - 1];
        const unreadCount = ordered.filter((m) => m.isUnread).length;

        // Determine peer (best effort):
        // Prefer a non-system message not authored by me.
        const peerMsg =
            ordered.find((m) => {
                if (m.sender === "system") return false;
                if (m.sender !== "counselor") return true;
                const sid = m.senderId != null ? String(m.senderId) : "";
                return sid && sid !== myUserId;
            }) ??
            // If none, try using recipient info from last message (when I sent all messages)
            last;

        let peerRole: PeerRole = "counselor";
        let peerName = "Counselor Office";
        let peerId: number | string | null | undefined = null;

        const mySentCounselor =
            peerMsg.sender === "counselor" && String(peerMsg.senderId ?? "") === myUserId;

        if (!mySentCounselor && peerMsg.sender !== "system") {
            // Peer is sender
            peerRole = (peerMsg.sender === "student" || peerMsg.sender === "guest" || peerMsg.sender === "counselor"
                ? peerMsg.sender
                : "counselor") as PeerRole;

            peerName =
                peerMsg.sender === "counselor" && peerMsg.senderName === counselorName
                    ? "Counselor"
                    : peerMsg.senderName || roleLabel(peerRole);

            peerId = peerMsg.senderId ?? peerMsg.userId ?? null;
        } else {
            // Peer is recipient (I sent it)
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
            peerRole === "counselor"
                ? "Counselor ↔ Counselor"
                : peerRole === "guest"
                    ? "Guest ↔ Counselor"
                    : "Student ↔ Counselor";

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

    // sort: unread first, then latest
    conversations.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return tb - ta;
    });

    return conversations;
}

const CounselorMessages: React.FC = () => {
    const session = getCurrentSession();
    const counselorName =
        session?.user && (session.user as any).name ? String((session.user as any).name) : "Counselor";
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

    const localIdRef = React.useRef(0);
    const bottomRef = React.useRef<HTMLDivElement | null>(null);

    const conversations = React.useMemo(() => buildConversations(messages, myUserId, counselorName), [
        messages,
        myUserId,
        counselorName,
    ]);

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

                // set initial active conversation
                const convs = buildConversations(ui, myUserId, counselorName);
                if (convs.length > 0) setActiveConversationId(convs[0].id);
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
    }, [myUserId, counselorName]);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversationId, activeMessages.length]);

    const markConversationRead = async () => {
        if (!activeConversationId) return;

        const unread = activeMessages.filter((m) => m.isUnread);
        if (unread.length === 0) return;

        setIsMarking(true);

        try {
            // Prefer marking specific IDs (numeric only); fallback to UI-only for local messages
            const numericIds = unread
                .map((m) => (typeof m.id === "number" ? m.id : Number.NaN))
                .filter((n) => Number.isInteger(n)) as number[];

            if (numericIds.length > 0) {
                await markCounselorMessagesAsRead(numericIds);
            } else {
                // No numeric ids to send; do nothing server-side
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

    const markSingleRead = async (msg: UiMessage) => {
        if (!msg.isUnread) return;

        // local/non-numeric ids: UI-only
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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeConversation) {
            toast.error("Select a conversation first.");
            return;
        }

        const text = draft.trim();
        if (!text) return;

        // prevent invalid targets
        if ((activeConversation.peerRole === "student" || activeConversation.peerRole === "guest") && !activeConversation.peerId) {
            toast.error("This conversation has no recipient id. Please refresh.");
            return;
        }

        const tempId = `local-${++localIdRef.current}`;
        const nowIso = new Date().toISOString();

        // Optimistic add
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
            };

            // Only student/guest require recipient_id; counselor can be office (null) or direct (id)
            if (activeConversation.peerId != null) payload.recipient_id = activeConversation.peerId;

            const res = await sendCounselorMessage(payload);
            const dto = res.messageRecord;

            const serverMsg = dto ? mapDtoToUi(dto) : null;

            if (serverMsg) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m)),
                );
            } else {
                // keep optimistic if backend doesn't return record
            }
        } catch (err) {
            // remove optimistic on failure
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            toast.error(err instanceof Error ? err.message : "Failed to send message.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <DashboardLayout
            title="Messages"
            description="Counselor messaging: Student ↔ Counselor, Guest ↔ Counselor, and Counselor ↔ Counselor only."
        >
            <div className="mx-auto w-full max-w-6xl">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-base">Counselor Inbox</CardTitle>
                        <CardDescription className="text-xs">
                            Threads appear only for <b>Student/Guest → Counselor</b> and <b>Counselor ↔ Counselor</b>.
                        </CardDescription>
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

                                    <Tabs value={roleFilter} onValueChange={(v: any) => setRoleFilter(v as any)}>
                                        <TabsList className="grid w-full grid-cols-4">
                                            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                                            <TabsTrigger value="student" className="text-xs">Student</TabsTrigger>
                                            <TabsTrigger value="guest" className="text-xs">Guest</TabsTrigger>
                                            <TabsTrigger value="counselor" className="text-xs">Counselor</TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="mt-3">
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search conversations…"
                                            className="h-9"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <ScrollArea className="h-[560px]">
                                    <div className="space-y-2 p-4">
                                        {isLoading ? (
                                            <div className="text-sm text-muted-foreground">Loading conversations…</div>
                                        ) : filteredConversations.length === 0 ? (
                                            <div className="rounded-lg border bg-white/60 p-4 text-sm text-muted-foreground">
                                                No conversations found.
                                            </div>
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

                                                        <div className="mt-2 truncate text-xs text-muted-foreground">
                                                            {c.lastMessage || "No messages yet."}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}

                                        <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                                            Blocked: <b>student↔student</b>, <b>student↔guest</b>, <b>guest↔guest</b>.
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* RIGHT: chat */}
                            <div className={`flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
                                <div className="flex items-center justify-between gap-3 border-b bg-white/70 p-4">
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
                                                    <AvatarFallback className="text-xs font-semibold">
                                                        {initials(activeConversation.peerName)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">
                                                        {activeConversation.peerName}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {roleLabel(activeConversation.peerRole)} • {activeConversation.subtitle}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">Select a conversation</div>
                                        )}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 px-3 text-xs"
                                        onClick={markConversationRead}
                                        disabled={!activeConversation || isMarking}
                                    >
                                        {isMarking ? "Marking…" : "Mark read"}
                                    </Button>
                                </div>

                                <ScrollArea className="h-[520px] bg-linear-to-b from-muted/30 to-white">
                                    <div className="space-y-3 p-4">
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
                                                    m.sender === "counselor" && String(m.senderId ?? "") === myUserId;

                                                const system = m.sender === "system";
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start";

                                                const bubble =
                                                    system
                                                        ? "border bg-white/90"
                                                        : mine
                                                            ? "border-indigo-200 bg-indigo-50/90"
                                                            : "border-slate-200 bg-white/90";

                                                return (
                                                    <div key={m.id} className={`flex ${align}`}>
                                                        <div className="max-w-[86%]">
                                                            {!system ? (
                                                                <div
                                                                    className={`mb-1 flex items-center gap-2 text-[0.70rem] text-muted-foreground ${mine ? "justify-end" : "justify-start"
                                                                        }`}
                                                                >
                                                                    <span className="font-medium text-slate-700">
                                                                        {mine ? "You" : m.senderName}
                                                                    </span>
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
                                                                </div>
                                                            ) : (
                                                                <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">
                                                                    {formatTimestamp(m.createdAt)}
                                                                </div>
                                                            )}

                                                            <div className={`rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${bubble}`}>
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

                                <form onSubmit={handleSend} className="border-t bg-white/80 p-4">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <Textarea
                                                value={draft}
                                                onChange={(e) => setDraft(e.target.value)}
                                                placeholder={
                                                    activeConversation ? `Message ${activeConversation.peerName}…` : "Select a conversation…"
                                                }
                                                disabled={!activeConversation || isSending}
                                                className="min-h-11 resize-none rounded-2xl"
                                            />
                                            <div className="mt-1 text-[0.70rem] text-muted-foreground">
                                                Allowed: Student ↔ Counselor, Guest ↔ Counselor, Counselor ↔ Counselor
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="h-11 rounded-2xl px-5"
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
            </div>
        </DashboardLayout>
    );
};

export default CounselorMessages;
