import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const benefits = [
    {
        title: "For Students",
        icon: "🎓",
        items: [
            "Request a guidance appointment from your phone or laptop",
            "View appointment status and history in one place",
            "Message the guidance office securely—no generic chat apps",
        ],
    },
    {
        title: "For Guidance Counselors",
        icon: "🧑‍⚕️",
        items: [
            "Centralized appointment requests and scheduling workflow",
            "Secure messaging for clarifications and follow-ups",
            "Reports and analytics support for campus needs",
        ],
    },
    {
        title: "For Administrators",
        icon: "📊",
        items: [
            "Dashboards for demand and appointment volume tracking",
            "Role-based access to protect sensitive student data",
            "Support for referrals and documentation requirements",
        ],
    },
];

const BenefitsSection: React.FC = () => {
    return (
        <section id="benefits" className="mx-auto px-4 space-y-6 md:px-8">
            <div className="space-y-2 text-center">
                <h2 className="text-balance text-2xl font-semibold tracking-tight text-amber-900 md:text-3xl">
                    Built for real campus guidance workflows
                </h2>
                <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                    The E-Guidance Appointment System streamlines appointment requests,
                    secure communication, referrals, and reporting for JRMSU.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {benefits.map((benefit) => (
                    <Card
                        key={benefit.title}
                        className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur"
                    >
                        <CardHeader className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{benefit.icon}</span>
                                <CardTitle className="text-base">{benefit.title}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1.5 text-xs text-muted-foreground md:text-sm">
                                {benefit.items.map((item) => (
                                    <li key={item} className="flex gap-2">
                                        <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
};

export default BenefitsSection;
