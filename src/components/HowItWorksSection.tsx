import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
    {
        step: "1",
        title: "Students submit a secure intake",
        body: "Students log in with their account, read the consent notice, and submit a short, structured intake describing their concern and preferred schedule.",
    },
    {
        step: "2",
        title: "Guidance counselors triage & schedule",
        body: "Counselors review new requests in a unified queue, apply priority labels, and confirm appointments with email reminders.",
    },
    {
        step: "3",
        title: "Sessions & case notes are documented",
        body: "Each session is captured using standardized note templates, keeping records consistent, auditable, and easy to follow over time.",
    },
    {
        step: "4",
        title: "Follow-ups, referrals & reports",
        body: "Counselors schedule follow-ups, manage referrals, and administrators view de-identified dashboards to improve staffing and services.",
    },
];

const HowItWorksSection: React.FC = () => {
    return (
        <section
            id="how-it-works"
            className="mx-auto max-w-6xl space-y-6 px-4 md:px-8"
        >
            <div className="space-y-2 text-center">
                <h2 className="text-balance text-2xl font-semibold tracking-tight text-amber-900 md:text-3xl">
                    How the eCounseling flow works
                </h2>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                    From first contact to closure, each step is designed to be clear,
                    timely, and aligned with privacy and mental health policies.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {steps.map((step) => (
                    <Card
                        key={step.step}
                        className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur"
                    >
                        <CardContent className="flex gap-4 py-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-yellow-400 text-sm font-semibold text-amber-900 shadow-sm">
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
