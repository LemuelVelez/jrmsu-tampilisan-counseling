/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        // Fallback if the date string is unexpected
        return isoString;
    }
    return format(date, "MMM d, yyyy • h:mm a");
};

const normaliseSender = (
    sender: StudentMessage["sender"],
): UiMessage["sender"] => {
    if (sender === "student" || sender === "counselor" || sender === "system") {
        return sender;
    }
    // Any unknown value from the backend → treat as system/office message
    return "system";
};

const mapDtoToUiMessage = (
    dto: StudentMessage,
    studentNameFallback: string,
): UiMessage => {
    const sender = normaliseSender(dto.sender);
    let senderName = dto.sender_name ?? "";

    if (!senderName) {
        if (sender === "student") {
            senderName = studentNameFallback;
        } else if (sender === "counselor") {
            senderName = "Guidance Counselor";
        } else {
            senderName = "Guidance & Counseling Office";
        }
    }

    return {
        id: dto.id ?? dto.created_at ?? Math.random().toString(36).slice(2),
        sender,
        senderName,
        content: dto.content ?? "",
        createdAt: dto.created_at ?? new Date().toISOString(),
        isUnread: dto.is_read === false || dto.is_read === 0,
    };
};

const buildInitialMessages = (studentName: string): UiMessage[] => [
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

const StudentMessages: React.FC = () => {
    const session = getCurrentSession();
    const studentName =
        (session?.user && (session.user as any).name)
            ? String((session.user as any).name)
            : "You";

    const [messages, setMessages] = React.useState<UiMessage[]>([]);
    const [draft, setDraft] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSending, setIsSending] = React.useState(false);
    const [isMarkingRead, setIsMarkingRead] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            try {
                const result = await fetchStudentMessages();
                const rawMessages = result.messages ?? [];

                if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
                    if (isMounted) {
                        setMessages(buildInitialMessages(studentName));
                    }
                    return;
                }

                const uiMessages = rawMessages.map((m) =>
                    mapDtoToUiMessage(m, studentName),
                );

                if (isMounted) {
                    setMessages(uiMessages);
                }
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to load your messages.";
                toast.error(message);

                if (isMounted) {
                    setMessages(buildInitialMessages(studentName));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadMessages();

        return () => {
            isMounted = false;
        };
    }, [studentName]);

    const hasUnread = messages.some((m) => m.isUnread);

    const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) return;

        setIsSending(true);

        try {
            const response = await sendStudentMessage(trimmed);
            const dto = response.messageRecord;

            const newMessage: UiMessage = dto
                ? mapDtoToUiMessage(dto, studentName)
                : {
                    id: Date.now(),
                    sender: "student",
                    senderName: studentName,
                    content: trimmed,
                    createdAt: new Date().toISOString(),
                    isUnread: false,
                };

            setMessages((prev) => [...prev, newMessage]);
            setDraft("");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to send your message.";
            toast.error(message);
        } finally {
            setIsSending(false);
        }
    };

    /**
     * Mark all messages as read.
     * Calls the backend endpoint with NO IDs so it can mark everything
     * belonging to the current student, which avoids the
     * "message_ids.0 must be an integer" validation issue.
     */
    const markAllAsRead = async () => {
        if (!messages.length || !hasUnread) return;

        setIsMarkingRead(true);

        try {
            await markStudentMessagesAsRead();

            // Optimistically update local UI state
            setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to mark messages as read.";
            toast.error(message);
        } finally {
            setIsMarkingRead(false);
        }
    };

    /**
     * Mark a single message as read when the user clicks the "NEW" badge.
     * Uses the dynamic [id] API helper, which converts IDs to integers
     * before sending them to Laravel.
     */
    const handleMarkSingleAsRead = async (message: UiMessage) => {
        if (!message.isUnread) return;

        // If the message has a non-numeric ID (like the local "intro" message),
        // just update UI state without calling the backend.
        if (typeof message.id !== "number") {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === message.id ? { ...m, isUnread: false } : m,
                ),
            );
            return;
        }

        try {
            await markStudentMessageReadByIdApi(message.id);

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === message.id ? { ...m, isUnread: false } : m,
                ),
            );
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to mark message as read.";
            toast.error(msg);
        }
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
                                    {isLoading
                                        ? "Loading messages..."
                                        : hasUnread
                                            ? "You have unread messages from the Guidance & Counseling Office."
                                            : "All messages are currently marked as read."}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[0.7rem]"
                                    onClick={markAllAsRead}
                                    disabled={isLoading || isMarkingRead || !hasUnread}
                                >
                                    {isMarkingRead ? "Marking..." : "Mark all as read"}
                                </Button>
                            </div>

                            {/* Message list */}
                            <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border border-amber-50 bg-amber-50/40 p-3">
                                {isLoading ? (
                                    <p className="py-8 text-center text-xs text-muted-foreground">
                                        Loading your messages&hellip;
                                    </p>
                                ) : messages.length === 0 ? (
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
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleMarkSingleAsRead(message)
                                                            }
                                                            className="rounded-full bg-amber-100 px-2 py-px text-[0.6rem] font-semibold text-amber-900 hover:bg-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        >
                                                            NEW
                                                        </button>
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
                                        disabled={!draft.trim() || isSending}
                                    >
                                        {isSending ? "Sending..." : "Send message"}
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
