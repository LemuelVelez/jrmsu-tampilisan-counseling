/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/authentication";

/**
 * Simple, front-end only message model.
 * This keeps everything in memory for now so the page works
 * even without a dedicated backend endpoint yet.
 * You can later replace this with real API calls.
 */
type SimpleMessage = {
    id: string;
    sender: "student" | "counselor" | "system";
    senderName: string;
    content: string;
    createdAt: string;
    isUnread?: boolean;
};

const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        // Fallback if the date string is unexpected
        return isoString;
    }
    return format(date, "MMM d, yyyy • h:mm a");
};

const buildInitialMessages = (): SimpleMessage[] => {
    const session = getCurrentSession();
    const studentName =
        (session?.user && (session.user as any).name) ? String((session.user as any).name) : "you";

    return [
        {
            id: "welcome",
            sender: "system",
            senderName: "Guidance & Counseling Office",
            content:
                "Welcome to your eCounseling messages. This is where updates about your counseling requests and follow-ups from your counselor will appear.",
            createdAt: new Date().toISOString(),
            isUnread: false,
        },
        {
            id: "intro",
            sender: "counselor",
            senderName: "Guidance Counselor",
            content: `Hi ${studentName}. If you have questions about your intake form, schedule, or evaluations, you can send them here and we’ll respond as soon as we can.`,
            createdAt: new Date().toISOString(),
            isUnread: true,
        },
    ];
};

const StudentMessages: React.FC = () => {
    const [messages, setMessages] = React.useState<SimpleMessage[]>(() =>
        buildInitialMessages(),
    );
    const [draft, setDraft] = React.useState("");
    const session = getCurrentSession();
    const studentName =
        (session?.user && (session.user as any).name) ? String((session.user as any).name) : "You";

    const hasUnread = messages.some((m) => m.isUnread);

    const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) return;

        const newMessage: SimpleMessage = {
            id: String(Date.now()),
            sender: "student",
            senderName: studentName,
            content: trimmed,
            createdAt: new Date().toISOString(),
            isUnread: false,
        };

        setMessages((prev) => [...prev, newMessage]);
        setDraft("");
    };

    const markAllAsRead = () => {
        setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
    };

    return (
        <DashboardLayout
            title="Messages"
            description="View updates from the Guidance & Counseling Office and send follow-up questions about your counseling requests."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-3xl space-y-4">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-base font-semibold text-amber-900">
                                Messages &amp; announcements
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This page shows messages related to your counseling intake, evaluations, and
                                follow-ups. It is not a real-time chat, but the Guidance &amp; Counseling Office
                                will review your messages together with your forms.
                            </p>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Status row */}
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[0.75rem] text-muted-foreground">
                                    {hasUnread
                                        ? "You have unread messages from the Guidance & Counseling Office."
                                        : "All messages are currently marked as read."}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[0.7rem]"
                                    onClick={markAllAsRead}
                                >
                                    Mark all as read
                                </Button>
                            </div>

                            {/* Message list */}
                            <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border border-amber-50 bg-amber-50/40 p-3">
                                {messages.length === 0 ? (
                                    <p className="py-8 text-center text-xs text-muted-foreground">
                                        You don&apos;t have any messages yet. After you submit an intake request or
                                        evaluation, updates from the Guidance &amp; Counseling Office will appear here.
                                    </p>
                                ) : (
                                    messages.map((message) => {
                                        const isStudent = message.sender === "student";
                                        const bubbleAlignment = isStudent
                                            ? "items-end text-right"
                                            : "items-start text-left";
                                        const bubbleBg = isStudent
                                            ? "bg-emerald-50/90 border-emerald-100"
                                            : message.sender === "system"
                                                ? "bg-slate-50/90 border-slate-100"
                                                : "bg-white/90 border-amber-100";

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex flex-col gap-1 ${bubbleAlignment}`}
                                            >
                                                <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                                                    <span className="font-medium text-amber-900">
                                                        {isStudent ? "You" : message.senderName}
                                                    </span>
                                                    <span aria-hidden="true">•</span>
                                                    <span>{formatTimestamp(message.createdAt)}</span>
                                                    {message.isUnread && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-px text-[0.6rem] font-semibold text-amber-900">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className={`inline-block max-w-[85%] rounded-lg border px-3 py-2 text-xs leading-relaxed text-slate-800 ${bubbleBg}`}
                                                >
                                                    {message.content}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Composer */}
                            <form onSubmit={handleSend} className="space-y-2 pt-1">
                                <label
                                    htmlFor="new_message"
                                    className="block text-xs font-medium text-amber-900"
                                >
                                    Send a follow-up message
                                </label>
                                <textarea
                                    id="new_message"
                                    name="new_message"
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    rows={4}
                                    placeholder="Ask a question about your schedule, clarify something from your intake form, or send an update about how you’re doing."
                                    className="w-full rounded-md border border-amber-100 bg-white/90 px-3 py-2 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={!draft.trim()}
                                    >
                                        Send message
                                    </Button>
                                    <p className="text-[0.7rem] text-muted-foreground sm:text-right">
                                        Messages are linked to your JRMSU account and are visible to the Guidance
                                        &amp; Counseling Office to help them support you better.
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentMessages;
