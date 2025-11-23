/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Prefer the VITE_GMAIL_ADDRESS_RECEPIENT env var (exposed to the browser),
// with a fallback to a non-VITE version if you also inject it some other way.
const CONTACT_EMAIL: string =
    (import.meta as any).env?.VITE_GMAIL_ADDRESS_RECEPIENT ??
    (import.meta as any).env?.GMAIL_ADDRESS_RECEPIENT ??
    "";

// Optional fallback to show in the UI if env is not set
const DISPLAY_EMAIL = CONTACT_EMAIL || "guidance.office@example.edu";

const buildGmailComposeUrl = (to: string, subject?: string, body?: string) => {
    const params = new URLSearchParams();
    params.set("view", "cm");
    params.set("fs", "1");
    params.set("to", to);

    if (subject) {
        params.set("su", subject);
    }
    if (body) {
        params.set("body", body);
    }

    return `https://mail.google.com/mail/?${params.toString()}`;
};

const ContactSection: React.FC = () => {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.currentTarget;
        const formData = new FormData(form);

        const name = String(formData.get("name") ?? "").trim();
        const email = String(formData.get("email") ?? "").trim();
        const topic = String(formData.get("topic") ?? "").trim();
        const message = String(formData.get("message") ?? "").trim();

        if (!CONTACT_EMAIL) {
            // If the env var is not wired up yet, we avoid trying to send.
            alert(
                "The contact email is not configured yet. Please set VITE_GMAIL_ADDRESS_RECEPIENT in your .env file."
            );
            return;
        }

        const subject = `Contact form: ${topic || "General inquiry"
            } from ${name || "JRMSU student"}`;

        const bodyLines = [
            `Name: ${name || "N/A"}`,
            `JRMSU email: ${email || "N/A"}`,
            `Topic: ${topic || "General inquiry"}`,
            "",
            "Message:",
            message || "N/A",
        ];

        const gmailUrl = buildGmailComposeUrl(
            CONTACT_EMAIL,
            subject,
            bodyLines.join("\n")
        );

        // Open Gmail compose in a new tab
        window.open(gmailUrl, "_blank", "noopener,noreferrer");

        // Optionally reset the form
        form.reset();
    };

    return (
        <section id="contact" className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="grid gap-8 rounded-3xl border border-amber-100/80 bg-white/80 p-6 shadow-sm shadow-amber-100/70 backdrop-blur md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8">
                {/* Left: contact details */}
                <div className="space-y-4 md:space-y-6">
                    <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50/80 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                        Need support or have questions?
                    </span>

                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-amber-900 md:text-3xl">
                        Connect with the Guidance &amp; Counseling Office
                    </h2>

                    <p className="text-sm text-muted-foreground md:text-base">
                        For urgent concerns, in-person appointments, or questions about using
                        the eCounseling system, you can reach the campus guidance team using
                        the details below or by sending a quick message.
                    </p>

                    <dl className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.16em] text-amber-800">
                                Office location
                            </dt>
                            <dd>
                                Guidance &amp; Counseling Office
                                <br />
                                JRMSU – Tampilisan Campus
                            </dd>
                        </div>

                        <div className="space-y-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.16em] text-amber-800">
                                Office hours
                            </dt>
                            <dd>
                                Monday – Friday, 8:00 AM – 5:00 PM
                                <br />
                                (excluding holidays)
                            </dd>
                        </div>

                        <div className="space-y-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.16em] text-amber-800">
                                Email
                            </dt>
                            <dd>
                                <a
                                    href={buildGmailComposeUrl(CONTACT_EMAIL || DISPLAY_EMAIL)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-900 underline-offset-4 hover:underline"
                                >
                                    {DISPLAY_EMAIL}
                                </a>
                            </dd>
                        </div>

                        <div className="space-y-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.16em] text-amber-800">
                                Phone
                            </dt>
                            <dd>(+63) 000 000 0000</dd>
                        </div>
                    </dl>

                    <p className="text-xs text-muted-foreground/80">
                        Note: For emergencies or immediate safety concerns, please contact your
                        local emergency services or campus security right away.
                    </p>
                </div>

                {/* Right: simple contact form */}
                <Card className="border-amber-100/80 bg-amber-50/60 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-amber-900">
                            Send a quick message
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            This form is for general questions about the eCounseling system. For
                            counseling requests, please use the{" "}
                            <span className="font-medium text-amber-900">Student Portal</span>{" "}
                            after signing in.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <form className="space-y-3" onSubmit={handleSubmit}>
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="contact-name"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Full name
                                </label>
                                <input
                                    id="contact-name"
                                    name="name"
                                    required
                                    placeholder="Juan Dela Cruz"
                                    className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="contact-email"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    JRMSU email
                                </label>
                                <input
                                    id="contact-email"
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="name@jrmsu.edu"
                                    className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="contact-topic"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    What is this about?
                                </label>
                                <input
                                    id="contact-topic"
                                    name="topic"
                                    placeholder="Account access, technical issue, general question..."
                                    className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="contact-message"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Message
                                </label>
                                <textarea
                                    id="contact-message"
                                    name="message"
                                    required
                                    rows={4}
                                    placeholder="Share a brief description of your concern or question."
                                    className="w-full rounded-md border border-amber-100 bg-white/90 px-3 py-2 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                            </div>

                            <Button type="submit" className="w-full">
                                Submit message
                            </Button>

                            <p className="pt-1 text-[0.7rem] text-muted-foreground">
                                When you submit, a new Gmail compose window will open with a message
                                addressed to the guidance office at{" "}
                                <span className="font-medium text-amber-900">{DISPLAY_EMAIL}</span>.
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
};

export default ContactSection;
