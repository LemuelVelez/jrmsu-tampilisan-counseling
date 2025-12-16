/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/authentication";
import { toast } from "sonner";
import {
    fetchStudentMessages,
    sendStudentMessage,
    markStudentMessagesAsRead,
    type StudentMessage,
} from "@/lib/messages";
import { markStudentMessageReadByIdApi } from "@/api/messages/[id]/route";

type UiMessage = {
    id: number | string;
    sender: "student" | "counselor" | "system";
    senderName: string;
    content: string;
    createdAt: string;
    isUnread?: boolean;
};

type ConversationPreview = {
    id: "counselor_thread";
    title: string;
    subtitle: string;
    unreadCount: number;
    lastMessage?: string;
    lastTimestamp?: string;
};

const SEED_MS = 1735718400000; // Jan 1, 2025 08:00:00 UTC (deterministic)

const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return format(date, "MMM d, yyyy • h:mm a");
};

const formatShortTime = (isoString?: string): string => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return format(date, "MMM d");
};

const normaliseSender = (
    sender: StudentMessage["sender"],
): UiMessage["sender"] => {
    if (sender === "student" || sender === "counselor" || sender === "system") {
        return sender;
    }
    return "system";
};

const mapDtoToUiMessage = (
    dto: StudentMessage,
    studentNameFallback: string,
    index: number,
): UiMessage => {
    const sender = normaliseSender(dto.sender);
    let senderName = dto.sender_name ?? "";

    if (!senderName) {
        if (sender === "student") senderName = studentNameFallback;
        else if (sender === "counselor") senderName = "Guidance Counselor";
        else senderName = "Guidance & Counseling Office";
    }

    const createdAt = dto.created_at ?? new Date(SEED_MS).toISOString();
    const stableFallbackId = `${createdAt}-${sender}-${index}`;

    return {
        id: dto.id ?? stableFallbackId,
        sender,
        senderName,
        content: dto.content ?? "",
        createdAt,
        isUnread: dto.is_read === false || dto.is_read === 0,
    };
};

const buildInitialMessages = (studentName: string): UiMessage[] => {
    const t1 = new Date(SEED_MS).toISOString();
    const t2 = new Date(SEED_MS + 60_000).toISOString();

    return [
        {
            id: "welcome",
            sender: "system",
            senderName: "Guidance & Counseling Office",
            content:
                "Welcome! This is your private conversation with the Guidance Counselor. You can send follow-up questions here.",
            createdAt: t1,
            isUnread: false,
        },
        {
            id: "intro",
            sender: "counselor",
            senderName: "Guidance Counselor",
            content: `Hi ${studentName}! Send a message anytime if you need help with your intake, schedule, or follow-ups.`,
            createdAt: t2,
            isUnread: true,
        },
    ];
};

const getInitials = (name: string) => {
    const cleaned = (name || "").trim();
    if (!cleaned) return "GC";
    const parts = cleaned.split(/\s+/).slice(0, 2);
    const letters = parts.map((p) => p.charAt(0).toUpperCase());
    return letters.join("") || "GC";
};

const AvatarCircle: React.FC<{ label: string; subLabel?: string }> = ({
    label,
    subLabel,
}) => {
    const initials = getInitials(label);
    return (
        <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border bg-white/80 text-sm font-semibold text-slate-800 shadow-sm">
                {initials}
            </div>
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                    {label}
                </div>
                {subLabel ? (
                    <div className="truncate text-xs text-muted-foreground">{subLabel}</div>
                ) : null}
            </div>
        </div>
    );
};

const StudentMessages: React.FC = () => {
    const session = getCurrentSession();
    const studentName =
        session?.user && (session.user as any).name
            ? String((session.user as any).name)
            : "You";

    const [messages, setMessages] = React.useState<UiMessage[]>([]);
    const [draft, setDraft] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSending, setIsSending] = React.useState(false);
    const [isMarkingRead, setIsMarkingRead] = React.useState(false);

    const [mobileView, setMobileView] = React.useState<"list" | "chat">("chat");

    const bottomRef = React.useRef<HTMLDivElement | null>(null);
    const localIdRef = React.useRef(0);
    const localClockRef = React.useRef(SEED_MS + 5 * 60_000);

    const nextLocalIso = React.useCallback(() => {
        localClockRef.current += 60_000;
        return new Date(localClockRef.current).toISOString();
    }, []);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    React.useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            try {
                const result = await fetchStudentMessages();
                const rawMessages = result.messages ?? [];

                if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
                    if (isMounted) setMessages(buildInitialMessages(studentName));
                    return;
                }

                const uiMessages = rawMessages.map((m, idx) =>
                    mapDtoToUiMessage(m, studentName, idx),
                );

                if (isMounted) setMessages(uiMessages);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to load your messages.";
                toast.error(message);

                if (isMounted) setMessages(buildInitialMessages(studentName));
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadMessages();

        return () => {
            isMounted = false;
        };
    }, [studentName]);

    const hasUnread = messages.some((m) => m.isUnread);

    const conversation: ConversationPreview = React.useMemo(() => {
        const unreadCount = messages.filter((m) => m.isUnread).length;
        const ordered = [...messages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const last = ordered[ordered.length - 1];

        return {
            id: "counselor_thread",
            title: "Guidance Counselor",
            subtitle: "Student ↔ Counselor (private)",
            unreadCount,
            lastMessage: last?.content ?? "",
            lastTimestamp: last?.createdAt ?? "",
        };
    }, [messages]);

    const markAllAsRead = async () => {
        if (!messages.length || !hasUnread) return;

        setIsMarkingRead(true);
        try {
            await markStudentMessagesAsRead();
            setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to mark messages as read.";
            toast.error(message);
        } finally {
            setIsMarkingRead(false);
        }
    };

    const handleMarkSingleAsRead = async (message: UiMessage) => {
        if (!message.isUnread) return;

        if (typeof message.id !== "number") {
            setMessages((prev) =>
                prev.map((m) => (m.id === message.id ? { ...m, isUnread: false } : m)),
            );
            return;
        }

        try {
            await markStudentMessageReadByIdApi(message.id);
            setMessages((prev) =>
                prev.map((m) => (m.id === message.id ? { ...m, isUnread: false } : m)),
            );
        } catch (error) {
            const msg =
                error instanceof Error ? error.message : "Failed to mark message as read.";
            toast.error(msg);
        }
    };

    const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) return;

        setIsSending(true);

        try {
            const response = await sendStudentMessage(trimmed);
            const dto = response.messageRecord;

            const newMessage: UiMessage = dto
                ? mapDtoToUiMessage(dto, studentName, messages.length)
                : {
                    id: `local-${++localIdRef.current}`,
                    sender: "student",
                    senderName: studentName,
                    content: trimmed,
                    createdAt: nextLocalIso(),
                    isUnread: false,
                };

            setMessages((prev) => [...prev, newMessage]);
            setDraft("");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to send your message.";
            toast.error(message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <DashboardLayout
            title="Messages"
            description="Chat privately with the Guidance Counselor (student ↔ counselor only)."
        >
            <div className="mx-auto w-full max-w-6xl">
                <div className="overflow-hidden rounded-2xl border bg-white/70 shadow-sm backdrop-blur">
                    <div className="grid min-h-[680px] grid-cols-1 md:grid-cols-[340px_1fr]">
                        {/* Sidebar */}
                        <aside
                            className={`border-b bg-white/60 p-3 md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"
                                }`}
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900">
                                    Conversations
                                </div>
                                <div className="text-xs text-muted-foreground">Student</div>
                            </div>

                            <div className="mb-3">
                                <div className="rounded-xl border bg-white/70 px-3 py-2">
                                    <input
                                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                        placeholder="Search (UI only)"
                                        disabled
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setMobileView("chat")}
                                className="w-full rounded-xl border bg-white/80 p-3 text-left transition hover:bg-white"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <AvatarCircle
                                        label={conversation.title}
                                        subLabel={conversation.subtitle}
                                    />
                                    <div className="flex items-center gap-2">
                                        {conversation.unreadCount > 0 ? (
                                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">
                                                {conversation.unreadCount}
                                            </span>
                                        ) : null}
                                        <span className="text-xs text-muted-foreground">
                                            {formatShortTime(conversation.lastTimestamp)}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 truncate text-xs text-muted-foreground">
                                    {conversation.lastMessage || "No messages yet."}
                                </div>
                            </button>

                            <div className="mt-4 rounded-xl border bg-slate-50/70 p-3 text-xs text-muted-foreground">
                                Only <span className="font-semibold">Student ↔ Counselor</span>{" "}
                                chats are available here.
                            </div>
                        </aside>

                        {/* Chat Panel */}
                        <section
                            className={`flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-3 border-b bg-white/70 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMobileView("list")}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/80 text-sm font-semibold text-slate-700 hover:bg-white md:hidden"
                                        aria-label="Back to conversations"
                                    >
                                        ←
                                    </button>
                                    <AvatarCircle label="Guidance Counselor" subLabel="Private thread" />
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-3 text-xs"
                                    onClick={markAllAsRead}
                                    disabled={isLoading || isMarkingRead || !hasUnread}
                                >
                                    {isMarkingRead ? "Marking..." : "Mark read"}
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50/80 to-white px-4 py-4">
                                {isLoading ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        Loading messages…
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No messages yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {messages.map((message) => {
                                            const isMe = message.sender === "student";
                                            const isSystem = message.sender === "system";
                                            const align = isSystem
                                                ? "justify-center"
                                                : isMe
                                                    ? "justify-end"
                                                    : "justify-start";

                                            const bubbleClass = isSystem
                                                ? "border bg-white/90 text-slate-700"
                                                : isMe
                                                    ? "border-emerald-200 bg-emerald-50/90 text-slate-800"
                                                    : "border-slate-200 bg-white/90 text-slate-800";

                                            return (
                                                <div key={message.id} className={`flex ${align}`}>
                                                    <div className="max-w-[86%]">
                                                        {!isSystem ? (
                                                            <div
                                                                className={`mb-1 flex items-center gap-2 text-[0.70rem] text-muted-foreground ${isMe ? "justify-end" : "justify-start"
                                                                    }`}
                                                            >
                                                                <span className="font-medium text-slate-700">
                                                                    {isMe ? "You" : message.senderName}
                                                                </span>
                                                                <span aria-hidden="true">•</span>
                                                                <span>{formatTimestamp(message.createdAt)}</span>

                                                                {message.isUnread ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMarkSingleAsRead(message)}
                                                                        className="rounded-full bg-amber-100 px-2 py-px text-[0.65rem] font-semibold text-amber-900 hover:bg-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                                    >
                                                                        NEW
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">
                                                                {formatTimestamp(message.createdAt)}
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${bubbleClass}`}
                                                        >
                                                            {message.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={bottomRef} />
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSend} className="border-t bg-white/80 px-4 py-3">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1 rounded-2xl border bg-white px-3 py-2 shadow-sm">
                                        <textarea
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            rows={1}
                                            className="max-h-28 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                            placeholder="Write a message…"
                                        />
                                        <div className="mt-1 text-[0.70rem] text-muted-foreground">
                                            Student ↔ Counselor only
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-11 rounded-2xl px-5"
                                        disabled={!draft.trim() || isSending}
                                    >
                                        {isSending ? "Sending…" : "Send"}
                                    </Button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentMessages;
