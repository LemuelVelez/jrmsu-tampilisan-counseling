import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroIllustration from "@/assets/images/hero.png";
import {
    getCurrentSession,
    subscribeToSession,
} from "@/lib/authentication";

const HeroSection: React.FC = () => {
    const [hasSession, setHasSession] = React.useState<boolean>(() => {
        try {
            const session = getCurrentSession();
            return !!session.user;
        } catch {
            return false;
        }
    });

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((session) => {
            setHasSession(!!session.user);
        });
        return unsubscribe;
    }, []);

    const primaryCtaPath = hasSession ? "/dashboard" : "/auth";
    const primaryCtaLabel = hasSession ? "Dashboard" : "Get started";

    return (
        <section id="hero" className="mx-auto px-4 py-10 sm:py-12 md:px-8 md:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
                {/* Left: copy + CTAs */}
                <div className="space-y-6 text-center lg:text-left max-w-2xl mx-auto lg:max-w-none">
                    <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50/80 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                        Request &amp; schedule guidance appointments online for JRMSU students
                    </span>

                    <h1 className="text-balance text-3xl font-semibold tracking-tight text-amber-900 sm:text-4xl lg:text-5xl">
                        Simple, secure{" "}
                        <span className="bg-linear-to-br from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                            appointment requests
                        </span>{" "}
                        for student support.
                    </h1>

                    <p className="mx-auto max-w-xl text-balance text-sm text-muted-foreground sm:text-base lg:mx-0">
                        The <span className="font-medium text-amber-900">E-Guidance Appointment System</span>{" "}
                        helps students request guidance support, schedule appointments, and send secure messages.
                        Counseling sessions are conducted outside the platform, while the system keeps requests,
                        updates, and appointment records organized for reporting.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                        <Button size="lg" asChild>
                            <Link to={primaryCtaPath}>{primaryCtaLabel}</Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <a href="#how-it-works">See how it works</a>
                        </Button>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2 sm:text-sm lg:max-w-md lg:mx-0">
                        <div>
                            <dt className="font-medium text-amber-900">Fast appointment requests</dt>
                            <dd>Submit concerns and preferred schedules in a few steps.</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-amber-900">Privacy by design</dt>
                            <dd>Role-based access and secure messaging for official follow-ups.</dd>
                        </div>
                    </dl>
                </div>

                {/* Right: hero image + small info card */}
                <div className="relative w-full max-w-sm mx-auto pb-4 sm:max-w-md md:max-w-lg lg:max-w-xl lg:mx-0">
                    <div className="aspect-4/3 w-full overflow-hidden rounded-3xl border border-amber-100/80 bg-amber-50/60 shadow-lg shadow-amber-100/70">
                        <img
                            src={heroIllustration}
                            alt="JRMSU student requesting a guidance appointment using the E-Guidance Appointment System"
                            className="h-full w-full object-cover"
                        />
                    </div>

                    <Card className="pointer-events-none mt-4 w-full max-w-sm mx-auto border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur sm:max-w-md lg:max-w-sm sm:mx-0 sm:mt-5 sm:absolute sm:-bottom-6 sm:left-6 sm:right-6">
                        <CardContent className="py-3">
                            <p className="text-[0.7rem] font-medium text-amber-900">
                                What students can do inside the system
                            </p>
                            <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                Request appointments, receive updates, and message the guidance office securely.
                            </p>
                            <div className="mt-3 flex items-center justify-between text-[0.7rem]">
                                <div className="space-y-0.5">
                                    <p className="font-semibold text-amber-900">Always accessible</p>
                                    <p className="text-muted-foreground">Any device, on or off campus</p>
                                </div>
                                <div className="h-10 w-px bg-amber-100" />
                                <div className="space-y-0.5 text-right">
                                    <p className="font-semibold text-amber-900">Guidance-led</p>
                                    <p className="text-muted-foreground">Built for campus workflow</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
