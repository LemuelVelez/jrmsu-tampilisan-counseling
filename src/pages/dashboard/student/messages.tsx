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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type UiSender = "student" | "guest" | "counselor" | "system";

type UiMessage = {
    id: number | string;
    sender: UiSender;
    senderName: string;
    content: string;
    createdAt: string;
    isUnread: boolean;
};

type ConversationPreview = {
    id: "counselor_thread";
    title: string;
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

function normalizeSender(sender: StudentMessage["sender"]): UiSender {
    if (sender === "student" || sender === "guest" || sender === "counselor" || sender === "system") return sender;
    return "system";
}

function mapDtoToUi(dto: StudentMessage, meName: string, index: number): UiMessage {
    const sender = normalizeSender(dto.sender);
    const senderName =
        (dto.sender_name && String(dto.sender_name).trim()) ||
        (sender === "system"
            ? "Guidance & Counseling Office"
            : sender === "counselor"
                ? "Guidance Counselor"
                : meName);

    const createdAt = dto.created_at ?? new Date(0).toISOString();
    const fallbackId = `${createdAt}-${sender}-${index}`;

    return {
        id: dto.id ?? fallbackId,
        sender,
        senderName,
        content: dto.content ?? "",
        createdAt,
        isUnread: dto.is_read === false || dto.is_read === 0,
    };
}

const StudentMessages: React.FC = () => {
    const session = getCurrentSession();
    const meName =
        session?.user && (session.user as any).name ? String((session.user as any).name) : "You";

    const [mobileView, setMobileView] = React.useState<"list" | "chat">("chat");

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSending, setIsSending] = React.useState(false);
    const [isMarking, setIsMarking] = React.useState(false);

    const [draft, setDraft] = React.useState("");
    const [messages, setMessages] = React.useState<UiMessage[]>([]);

    const bottomRef = React.useRef<HTMLDivElement | null>(null);
    const localIdRef = React.useRef(0);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    React.useEffect(() => {
        let mounted = true;

        const load = async () => {
            setIsLoading(true);
            try {
                const res = await fetchStudentMessages();
                const raw = Array.isArray(res.messages) ? res.messages : [];
                const ui = raw.map((m, idx) => mapDtoToUi(m, meName, idx));

                if (!mounted) return;
                setMessages(ui);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to load your messages.");
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, [meName]);

    const hasUnread = messages.some((m) => m.isUnread);

    const conversation: ConversationPreview = React.useMemo(() => {
        const ordered = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const last = ordered[ordered.length - 1];

        return {
            id: "counselor_thread",
            title: "Guidance Counselor",
            subtitle: "Private thread (Student/Guest ↔ Counselor)",
            unreadCount: messages.filter((m) => m.isUnread).length,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
        };
    }, [messages]);

    const markAllAsRead = async () => {
        if (!hasUnread) return;

        setIsMarking(true);
        try {
            await markStudentMessagesAsRead();
            setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to mark messages as read.");
        } finally {
            setIsMarking(false);
        }
    };

    const markSingleAsRead = async (msg: UiMessage) => {
        if (!msg.isUnread) return;

        // local/non-numeric ids: UI-only
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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text) return;

        const tempId = `local-${++localIdRef.current}`;
        const nowIso = new Date().toISOString();

        // Optimistic add
        const optimistic: UiMessage = {
            id: tempId,
            sender: "student",
            senderName: meName,
            content: text,
            createdAt: nowIso,
            isUnread: false,
        };

        setMessages((prev) => [...prev, optimistic]);
        setDraft("");
        setIsSending(true);

        try {
            const res = await sendStudentMessage(text);
            const dto = res.messageRecord;

            if (dto) {
                const serverMsg = mapDtoToUi(dto, meName, messages.length);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...serverMsg, isUnread: false } : m)));
            }
        } catch (err) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            toast.error(err instanceof Error ? err.message : "Failed to send your message.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <DashboardLayout
            title="Messages"
            description="Chat privately with the Guidance Counselor (Student/Guest ↔ Counselor only)."
        >
            <div className="mx-auto w-full max-w-6xl">
                <Card className="overflow-hidden border bg-white/70 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-base">Messages</CardTitle>
                        <CardDescription className="text-xs">
                            This is a private conversation between your account and the Guidance Counselor.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="grid min-h-[680px] grid-cols-1 md:grid-cols-[340px_1fr]">
                            {/* LEFT: conversation list */}
                            <div className={`border-b md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
                                <div className="p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-900">Conversations</div>
                                        <Badge variant="secondary" className="text-[0.70rem]">
                                            Student
                                        </Badge>
                                    </div>

                                    {/* one-thread UI (search disabled but uses Input shadcn as requested) */}
                                    <Input disabled value="" placeholder="Search (coming soon)" className="h-9" />
                                </div>

                                <Separator />

                                <ScrollArea className="h-[560px]">
                                    <div className="space-y-2 p-4">
                                        <button
                                            type="button"
                                            onClick={() => setMobileView("chat")}
                                            className="w-full rounded-xl border bg-white/60 p-3 text-left transition hover:bg-white"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar className="h-9 w-9 border">
                                                        <AvatarFallback className="text-xs font-semibold">
                                                            {initials(conversation.title)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-slate-900">
                                                            {conversation.title}
                                                        </div>
                                                        <div className="truncate text-xs text-muted-foreground">{conversation.subtitle}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {conversation.unreadCount > 0 ? (
                                                        <Badge className="h-6 min-w-6 justify-center rounded-full px-2 text-xs">
                                                            {conversation.unreadCount}
                                                        </Badge>
                                                    ) : null}
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatShort(conversation.lastTimestamp)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-2 truncate text-xs text-muted-foreground">
                                                {conversation.lastMessage || "No messages yet."}
                                            </div>
                                        </button>

                                        <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                                            Only <b>Student/Guest ↔ Counselor</b> is allowed here.
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

                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border">
                                                <AvatarFallback className="text-xs font-semibold">
                                                    {initials("Guidance Counselor")}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-slate-900">Guidance Counselor</div>
                                                <div className="truncate text-xs text-muted-foreground">Private thread</div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 px-3 text-xs"
                                        onClick={markAllAsRead}
                                        disabled={isLoading || isMarking || !hasUnread}
                                    >
                                        {isMarking ? "Marking…" : "Mark read"}
                                    </Button>
                                </div>

                                <ScrollArea className="h-[520px] bg-linear-to-b from-muted/30 to-white">
                                    <div className="space-y-3 p-4">
                                        {isLoading ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">Loading messages…</div>
                                        ) : messages.length === 0 ? (
                                            <div className="py-10 text-center text-sm text-muted-foreground">No messages yet.</div>
                                        ) : (
                                            messages.map((m) => {
                                                const mine = m.sender === "student" || m.sender === "guest";
                                                const system = m.sender === "system";
                                                const align = system ? "justify-center" : mine ? "justify-end" : "justify-start";

                                                const bubble =
                                                    system
                                                        ? "border bg-white/90"
                                                        : mine
                                                            ? "border-emerald-200 bg-emerald-50/90"
                                                            : "border-slate-200 bg-white/90";

                                                return (
                                                    <div key={m.id} className={`flex ${align}`}>
                                                        <div className="max-w-[86%]">
                                                            {!system ? (
                                                                <div
                                                                    className={`mb-1 flex items-center gap-2 text-[0.70rem] text-muted-foreground ${mine ? "justify-end" : "justify-start"
                                                                        }`}
                                                                >
                                                                    <span className="font-medium text-slate-700">{mine ? "You" : m.senderName}</span>
                                                                    <span aria-hidden="true">•</span>
                                                                    <span>{formatTimestamp(m.createdAt)}</span>

                                                                    {m.isUnread ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => markSingleAsRead(m)}
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
                                                placeholder="Write a message…"
                                                disabled={isSending}
                                                className="min-h-11 resize-none rounded-2xl"
                                            />
                                            <div className="mt-1 text-[0.70rem] text-muted-foreground">
                                                Allowed: Student/Guest ↔ Counselor
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="h-11 rounded-2xl px-5"
                                            disabled={isSending || !draft.trim()}
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

export default StudentMessages;
