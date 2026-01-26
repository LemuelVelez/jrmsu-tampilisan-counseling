import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
    {
        step: "1",
        title: "Students submit an appointment request",
        body: "Students log in, read the consent notice, and submit a short request describing their concern, preferred schedule, and availability.",
    },
    {
        step: "2",
        title: "Guidance counselors review & confirm",
        body: "Counselors review requests, prioritize as needed, and confirm the appointment schedule using the dashboard queue.",
    },
    {
        step: "3",
        title: "Secure updates & messaging",
        body: "Students receive updates and can message the counselor/office for clarifications, follow-ups, or rescheduling—without using external chat apps.",
    },
    {
        step: "4",
        title: "Referrals & reporting support",
        body: "The system supports referrals from authorized staff and provides records for reports and analytics while keeping sensitive details protected.",
    },
];

const HowItWorksSection: React.FC = () => {
    return (
        <section id="how-it-works" className="mx-auto px-4 space-y-6 md:px-8">
            <div className="space-y-2 text-center">
                <h2 className="text-balance text-2xl font-semibold tracking-tight text-amber-900 md:text-3xl">
                    How the E-Guidance Appointment System works
                </h2>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                    The platform focuses on requesting, scheduling, messaging, referrals, and reporting —
                    counseling sessions are conducted outside the system through official guidance processes.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {steps.map((step) => (
                    <Card
                        key={step.step}
                        className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur"
                    >
                        <CardContent className="flex gap-4 py-4">
                            <div className="flex h-8 w-8 flex-none shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-yellow-400 text-sm font-semibold text-amber-900 shadow-sm">
                                {step.step}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-amber-900 md:text-base">
                                    {step.title}
                                </h3>
                                <p className="text-xs text-muted-foreground md:text-sm">
                                    {step.body}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
};

export default HowItWorksSection;
