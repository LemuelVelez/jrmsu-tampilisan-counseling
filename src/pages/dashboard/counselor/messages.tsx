/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/authentication";

type PeerRole = "student" | "guest" | "counselor";

type Conversation = {
    id: string;
    peerName: string;
    peerRole: PeerRole;
    subtitle?: string;
};

type ChatMessage = {
    id: string;
    conversationId: string;
    sender: "me" | "peer" | "system";
    senderName: string;
    text: string;
    createdAt: string;
    isUnread?: boolean;
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

const getInitials = (name: string) => {
    const cleaned = (name || "").trim();
    if (!cleaned) return "GC";
    const parts = cleaned.split(/\s+/).slice(0, 2);
    const letters = parts.map((p) => p.charAt(0).toUpperCase());
    return letters.join("") || "GC";
};

const roleBadge = (role: PeerRole) => {
    if (role === "student") return "Student";
    if (role === "guest") return "Guest";
    return "Counselor";
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
                <div className="truncate text-sm font-semibold text-slate-900">{label}</div>
                {subLabel ? (
                    <div className="truncate text-xs text-muted-foreground">{subLabel}</div>
                ) : null}
            </div>
        </div>
    );
};

const CounselorMessages: React.FC = () => {
    const session = getCurrentSession();
    const counselorName =
        session?.user && (session.user as any).name
            ? String((session.user as any).name)
            : "Counselor";

    const [conversations] = React.useState<Conversation[]>([
        { id: "c-student-1", peerName: "Alex Santos", peerRole: "student", subtitle: "Intake follow-up" },
        { id: "c-guest-1", peerName: "Guest (Walk-in)", peerRole: "guest", subtitle: "Anonymous inquiry" },
        { id: "c-counselor-1", peerName: "Counselor Maria D.", peerRole: "counselor", subtitle: "Case coordination" },
    ]);

    const [activeRoleFilter, setActiveRoleFilter] = React.useState<"all" | PeerRole>("all");
    const [search, setSearch] = React.useState("");
    const [activeId, setActiveId] = React.useState<string>(conversations[0]?.id);
    const [mobileView, setMobileView] = React.useState<"list" | "chat">("list");
    const [draft, setDraft] = React.useState("");

    const bottomRef = React.useRef<HTMLDivElement | null>(null);
    const localIdRef = React.useRef(0);
    const localClockRef = React.useRef(SEED_MS + 60_000 * 30);

    const nextLocalIso = React.useCallback(() => {
        localClockRef.current += 60_000;
        return new Date(localClockRef.current).toISOString();
    }, []);

    const [messagesByConversation, setMessagesByConversation] = React.useState<
        Record<string, ChatMessage[]>
    >(() => {
        // deterministic “mock” times
        const t1 = new Date(SEED_MS - 60_000 * 20).toISOString();
        const t2 = new Date(SEED_MS - 60_000 * 6).toISOString();
        const t3 = new Date(SEED_MS - 60_000 * 25).toISOString();
        const t4 = new Date(SEED_MS).toISOString();

        return {
            "c-student-1": [
                {
                    id: "m1",
                    conversationId: "c-student-1",
                    sender: "peer",
                    senderName: "Alex Santos",
                    text: "Good day counselor, I have a question about my schedule request.",
                    createdAt: t1,
                    isUnread: true,
                },
                {
                    id: "m2",
                    conversationId: "c-student-1",
                    sender: "me",
                    senderName: counselorName,
                    text: "Hi Alex—sure. What part of the schedule do you want to clarify?",
                    createdAt: t2,
                    isUnread: false,
                },
            ],
            "c-guest-1": [
                {
                    id: "g1",
                    conversationId: "c-guest-1",
                    sender: "peer",
                    senderName: "Guest",
                    text: "Hello, can I ask something privately? I’m not comfortable sharing my name yet.",
                    createdAt: t2,
                    isUnread: true,
                },
            ],
            "c-counselor-1": [
                {
                    id: "cc1",
                    conversationId: "c-counselor-1",
                    sender: "peer",
                    senderName: "Counselor Maria D.",
                    text: "Can we align on the referral flow for next week’s intake?",
                    createdAt: t3,
                    isUnread: false,
                },
                {
                    id: "cc2",
                    conversationId: "c-counselor-1",
                    sender: "me",
                    senderName: counselorName,
                    text: "Yes—let’s coordinate. I’ll share the updated checklist here.",
                    createdAt: t4,
                    isUnread: false,
                },
            ],
        };
    });

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeId, messagesByConversation]);

    const activeConversation = conversations.find((c) => c.id === activeId);
    const activeMessages = messagesByConversation[activeId] ?? [];

    const unreadCountForConversation = (id: string) =>
        (messagesByConversation[id] ?? []).filter((m) => m.isUnread).length;

    const lastMessageForConversation = (id: string) => {
        const msgs = messagesByConversation[id] ?? [];
        if (msgs.length === 0) return undefined;
        const ordered = [...msgs].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return ordered[ordered.length - 1];
    };

    const filteredConversations = conversations
        .filter((c) => (activeRoleFilter === "all" ? true : c.peerRole === activeRoleFilter))
        .filter((c) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
                c.peerName.toLowerCase().includes(q) ||
                (c.subtitle ?? "").toLowerCase().includes(q) ||
                roleBadge(c.peerRole).toLowerCase().includes(q)
            );
        });

    const markActiveAsRead = () => {
        const msgs = messagesByConversation[activeId] ?? [];
        const hasUnread = msgs.some((m) => m.isUnread);
        if (!hasUnread) return;

        setMessagesByConversation((prev) => ({
            ...prev,
            [activeId]: (prev[activeId] ?? []).map((m) => ({ ...m, isUnread: false })),
        }));
        toast.success("Marked as read (UI only).");
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeConversation) return;

        const trimmed = draft.trim();
        if (!trimmed) return;

        const newMsg: ChatMessage = {
            id: `local-${++localIdRef.current}`,
            conversationId: activeConversation.id,
            sender: "me",
            senderName: counselorName,
            text: trimmed,
            createdAt: nextLocalIso(),
            isUnread: false,
        };

        setMessagesByConversation((prev) => ({
            ...prev,
            [activeConversation.id]: [...(prev[activeConversation.id] ?? []), newMsg],
        }));
        setDraft("");
    };

    return (
        <DashboardLayout
            title="Messages"
            description="Counselor messaging: Student ↔ Counselor, Guest ↔ Counselor, and Counselor ↔ Counselor only."
        >
            <div className="mx-auto w-full max-w-6xl">
                <div className="overflow-hidden rounded-2xl border bg-white/70 shadow-sm backdrop-blur">
                    <div className="grid min-h-[700px] grid-cols-1 md:grid-cols-[360px_1fr]">
                        {/* Sidebar */}
                        <aside
                            className={`border-b bg-white/60 p-3 md:border-b-0 md:border-r ${mobileView === "chat" ? "hidden md:block" : "block"
                                }`}
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900">Inbox</div>
                                <div className="text-xs text-muted-foreground">{counselorName}</div>
                            </div>

                            <div className="mb-3 grid grid-cols-4 gap-2">
                                {(["all", "student", "guest", "counselor"] as const).map((k) => {
                                    const active = activeRoleFilter === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setActiveRoleFilter(k)}
                                            className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${active
                                                    ? "bg-slate-900 text-white"
                                                    : "bg-white/70 text-slate-700 hover:bg-white"
                                                }`}
                                        >
                                            {k === "all" ? "All" : roleBadge(k)}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mb-3 rounded-xl border bg-white/70 px-3 py-2">
                                <input
                                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                    placeholder="Search people / role / notes…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                {filteredConversations.length === 0 ? (
                                    <div className="rounded-xl border bg-slate-50/70 p-4 text-sm text-muted-foreground">
                                        No conversations found.
                                    </div>
                                ) : (
                                    filteredConversations.map((c) => {
                                        const active = c.id === activeId;
                                        const unread = unreadCountForConversation(c.id);
                                        const last = lastMessageForConversation(c.id);

                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveId(c.id);
                                                    setMobileView("chat");
                                                }}
                                                className={`w-full rounded-xl border p-3 text-left transition ${active ? "bg-white shadow-sm" : "bg-white/70 hover:bg-white"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <AvatarCircle
                                                        label={c.peerName}
                                                        subLabel={`${roleBadge(c.peerRole)} • ${c.subtitle ?? "Conversation"}`}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        {unread > 0 ? (
                                                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">
                                                                {unread}
                                                            </span>
                                                        ) : null}
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatShortTime(last?.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-2 truncate text-xs text-muted-foreground">
                                                    {last ? `${last.sender === "me" ? "You: " : ""}${last.text}` : "No messages yet."}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            <div className="mt-4 rounded-xl border bg-slate-50/70 p-3 text-xs text-muted-foreground">
                                This UI intentionally prevents <b>student↔student</b>, <b>student↔guest</b>, and <b>guest↔guest</b> threads.
                            </div>
                        </aside>

                        {/* Chat panel */}
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

                                    {activeConversation ? (
                                        <AvatarCircle
                                            label={activeConversation.peerName}
                                            subLabel={`${roleBadge(activeConversation.peerRole)} • ${activeConversation.subtitle ?? "Conversation"}`}
                                        />
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Select a conversation</div>
                                    )}
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-3 text-xs"
                                    onClick={markActiveAsRead}
                                    disabled={!activeConversation}
                                >
                                    Mark read
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50/80 to-white px-4 py-4">
                                {!activeConversation ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        Choose a conversation from the left.
                                    </div>
                                ) : activeMessages.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No messages yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeMessages.map((m) => {
                                            const isMe = m.sender === "me";
                                            const isSystem = m.sender === "system";
                                            const align = isSystem
                                                ? "justify-center"
                                                : isMe
                                                    ? "justify-end"
                                                    : "justify-start";

                                            const bubbleClass = isSystem
                                                ? "border bg-white/90 text-slate-700"
                                                : isMe
                                                    ? "border-indigo-200 bg-indigo-50/90 text-slate-800"
                                                    : "border-slate-200 bg-white/90 text-slate-800";

                                            return (
                                                <div key={m.id} className={`flex ${align}`}>
                                                    <div className="max-w-[86%]">
                                                        {!isSystem ? (
                                                            <div
                                                                className={`mb-1 flex items-center gap-2 text-[0.70rem] text-muted-foreground ${isMe ? "justify-end" : "justify-start"
                                                                    }`}
                                                            >
                                                                <span className="font-medium text-slate-700">
                                                                    {isMe ? "You" : m.senderName}
                                                                </span>
                                                                <span aria-hidden="true">•</span>
                                                                <span>{formatTimestamp(m.createdAt)}</span>
                                                                {m.isUnread ? (
                                                                    <span className="rounded-full bg-amber-100 px-2 py-px text-[0.65rem] font-semibold text-amber-900">
                                                                        NEW
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <div className="mb-1 text-center text-[0.70rem] text-muted-foreground">
                                                                {formatTimestamp(m.createdAt)}
                                                            </div>
                                                        )}

                                                        <div
                                                            className={`rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm ${bubbleClass}`}
                                                        >
                                                            {m.text}
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
                                            placeholder={
                                                activeConversation
                                                    ? `Message ${activeConversation.peerName}…`
                                                    : "Select a conversation…"
                                            }
                                            disabled={!activeConversation}
                                        />
                                        <div className="mt-1 text-[0.70rem] text-muted-foreground">
                                            Allowed: Student ↔ Counselor, Guest ↔ Counselor, Counselor ↔ Counselor
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="h-11 rounded-2xl px-5"
                                        disabled={!activeConversation || !draft.trim()}
                                    >
                                        Send
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

export default CounselorMessages;
