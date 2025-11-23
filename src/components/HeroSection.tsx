// src/components/HeroSection.tsx
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroIllustration from "@/assets/images/hero.png";

const HeroSection: React.FC = () => {
    return (
        <section
            id="hero"
            className="mx-auto max-w-6xl px-4 py-10 sm:py-12 md:px-8 md:py-16"
        >
            {/* 
        Mobile / tablet: vertical (single column)
        Desktop (lg+): horizontal (two columns)
      */}
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
                {/* Left: copy + CTAs */}
                <div className="space-y-6 text-center lg:text-left max-w-2xl mx-auto lg:max-w-none">
                    <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50/80 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                        Centralized online guidance &amp; counseling for JRMSU students
                    </span>

                    <h1 className="text-balance text-3xl font-semibold tracking-tight text-amber-900 sm:text-4xl lg:text-5xl">
                        A safe digital space for{" "}
                        <span className="bg-linear-to-br from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                            student support
                        </span>
                        , anytime.
                    </h1>

                    <p className="mx-auto max-w-xl text-balance text-sm text-muted-foreground sm:text-base lg:mx-0">
                        eCounseling brings intake, triage, appointment scheduling, and secure
                        messaging into one privacy-aware platform, designed specifically for
                        JRMSU students, guidance counselors, and administrators.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                        <Button size="lg" asChild>
                            <Link to="/auth">Get started</Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <a href="#how-it-works">See how it works</a>
                        </Button>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2 sm:text-sm lg:max-w-md lg:mx-0">
                        <div>
                            <dt className="font-medium text-amber-900">Campus-wide access</dt>
                            <dd>Students can request help from any device, on or off campus.</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-amber-900">Privacy by design</dt>
                            <dd>
                                Role-based access, consent prompts, and secure records built-in.
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Right: hero image + small info card */}
                <div className="relative w-full max-w-sm mx-auto pb-4 sm:max-w-md md:max-w-lg lg:max-w-xl lg:mx-0">
                    <div className="aspect-4/3 w-full overflow-hidden rounded-3xl border border-amber-100/80 bg-amber-50/60 shadow-lg shadow-amber-100/70">
                        <img
                            src={heroIllustration}
                            alt="JRMSU student using the eCounseling platform on a laptop"
                            className="h-full w-full object-cover"
                        />
                    </div>

                    {/* 
            Mobile: card appears below image as a normal block.
            Desktop: card floats over the image near the bottom.
          */}
                    <Card className="pointer-events-none mt-4 w-full max-w-sm mx-auto border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur sm:max-w-md lg:max-w-sm sm:mx-0 sm:mt-5 sm:absolute sm:-bottom-6 sm:left-6 sm:right-6">
                        <CardContent className="py-3">
                            <p className="text-[0.7rem] font-medium text-amber-900">
                                What students experience
                            </p>
                            <p className="mt-1 text-[0.7rem] text-muted-foreground">
                                Clear steps for requesting help, viewing appointments, and
                                messaging their counselor — all in one secure place.
                            </p>
                            <div className="mt-3 flex items-center justify-between text-[0.7rem]">
                                <div className="space-y-0.5">
                                    <p className="font-semibold text-amber-900">24/7 access</p>
                                    <p className="text-muted-foreground">
                                        Any device, on or off campus
                                    </p>
                                </div>
                                <div className="h-10 w-px bg-amber-100" />
                                <div className="space-y-0.5 text-right">
                                    <p className="font-semibold text-amber-900">Guidance-led</p>
                                    <p className="text-muted-foreground">
                                        Built with JRMSU offices
                                    </p>
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
