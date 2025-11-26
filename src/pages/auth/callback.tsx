import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroIllustration from "@/assets/images/hero.png";
import ecounselingLogo from "@/assets/images/ecounseling.svg";
import { Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const AuthCallbackPage: React.FC = () => {
    const navigate = useNavigate();

    // In a real app, you would read query params / hash here and call your API
    // to finish sign-in or verification.
    // TODO: hook this page up to the real auth callback logic.

    return (
        <div className="min-h-screen bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60 px-4 py-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
                {/* Header with logo (clickable back to landing page) */}
                <div className="flex items-center justify-between gap-2">
                    <Link to="/" className="flex items-center gap-3">
                        <img
                            src={ecounselingLogo}
                            alt="eCounseling logo"
                            className="h-8 w-auto"
                        />
                        <div className="flex flex-col">
                            <h1 className="text-lg font-semibold tracking-tight text-amber-900">
                                eCounseling Portal
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                JRMSU – Tampilisan Campus
                            </p>
                        </div>
                    </Link>
                </div>

                <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                    <CardContent className="grid p-0 md:grid-cols-2">
                        <div className="flex flex-col gap-6 p-6 md:p-8 justify-center">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-800" />
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    Finishing sign-in
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    Please wait while we verify your information and complete your
                                    eCounseling sign-in. This should only take a moment.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <Button
                                    type="button"
                                    className="w-full max-w-xs"
                                    onClick={() => navigate("/auth")}
                                >
                                    Go to sign in
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                    If you are not redirected automatically, you can safely click
                                    the button above to return to the portal.
                                </p>
                            </div>
                        </div>

                        <div className="bg-muted relative hidden md:block">
                            <img
                                src={heroIllustration}
                                alt="JRMSU student using the eCounseling platform"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AuthCallbackPage;
