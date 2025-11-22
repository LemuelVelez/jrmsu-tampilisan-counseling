import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const HeroSection: React.FC = () => {
    const handleDemoSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        // purely UI/demo – no actual backend
    };

    return (
        <section
            id="hero"
            className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 md:px-8 md:pt-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        >
            <div className="space-y-6">
                <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50/80 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                    Centralized online guidance &amp; counseling for JRMSU students
                </span>

                <h1 className="text-balance text-3xl font-semibold tracking-tight text-amber-900 md:text-4xl lg:text-5xl">
                    A safe digital space for{" "}
                    <span className="bg-linear-to-br from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                        student support
                    </span>
                    , anytime.
                </h1>

                <p className="max-w-xl text-balance text-sm text-muted-foreground md:text-base">
                    eCounseling brings intake, triage, appointment scheduling, and secure
                    messaging into one privacy-aware platform, designed specifically for
                    JRMSU students, guidance counselors, and administrators.
                </p>

                <div className="flex flex-wrap gap-3">
                    <Button size="lg" asChild>
                        <Link to="/auth">Get started</Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <a href="#how-it-works">See how it works</a>
                    </Button>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground md:text-sm lg:max-w-md">
                    <div>
                        <dt className="font-medium text-amber-900">Campus-wide access</dt>
                        <dd>Students can request help from any device, on or off campus.</dd>
                    </div>
                    <div>
                        <dt className="font-medium text-amber-900">
                            Privacy by design
                        </dt>
                        <dd>
                            Role-based access, consent prompts, and secure records built-in.
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="lg:justify-self-end">
                <Card className="border-amber-100/80 bg-amber-50/70 shadow-lg shadow-amber-100/70 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-base">
                            Try a quick request (demo UI)
                        </CardTitle>
                        <CardDescription className="text-xs">
                            This preview shows how a student can safely reach out for
                            guidance. In the real system, details are encrypted and visible
                            only to authorized counselors.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-3 text-xs" onSubmit={handleDemoSubmit}>
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Full name</Label>
                                <Input id="name" placeholder="Juan Dela Cruz" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email">JRMSU email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="juan.delacruz@jrmsu.edu.ph"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="concern">What would you like help with?</Label>
                                <Textarea
                                    id="concern"
                                    rows={3}
                                    placeholder="Briefly describe your concern (stress, academics, relationships, etc.)."
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Preview request flow
                            </Button>
                            <p className="text-[0.7rem] text-muted-foreground">
                                This is a static demo. In production, this form will securely
                                create a counseling case and notify the Guidance Office.
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
};

export default HeroSection;
