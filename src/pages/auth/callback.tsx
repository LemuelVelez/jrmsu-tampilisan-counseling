import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroIllustration from "@/assets/images/hero.png";
import ecounselingLogo from "@/assets/images/ecounseling.svg";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchCurrentUserFromServer } from "@/lib/authentication";

type CallbackStatus = "processing" | "success" | "error";

const resolveDashboardPathForRole = (
    role: string | null | undefined,
): string => {
    const normalized = (role ?? "").toString().toLowerCase();

    if (normalized.includes("admin")) {
        return "/dashboard/admin";
    }

    if (normalized.includes("counselor") || normalized.includes("counsellor")) {
        return "/dashboard/counselor";
    }

    // Default to student dashboard for unknown roles.
    return "/dashboard/student";
};

const AuthCallbackPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [status, setStatus] = React.useState<CallbackStatus>("processing");
    const [message, setMessage] = React.useState<string | null>(null);
    const [redirectPath, setRedirectPath] = React.useState<string>("/auth");

    React.useEffect(() => {
        let isMounted = true;
        let timeoutId: number | undefined;

        const finishAuth = async () => {
            const explicitStatus = searchParams.get("status");
            const explicitMessage = searchParams.get("message");
            const intent =
                searchParams.get("intent") ??
                searchParams.get("event") ??
                searchParams.get("mode") ??
                undefined;
            const redirectParam = searchParams.get("redirect");

            try {
                // Ask the backend who the current user is. If this callback is the
                // result of a successful sign-in or email verification, the backend
                // should have already set the session cookie.
                const session = await fetchCurrentUserFromServer();

                if (!isMounted) return;

                if (session?.user) {
                    setStatus("success");
                    setMessage(
                        explicitMessage ??
                        (intent === "email-verification"
                            ? "Your email has been verified. Redirecting you to your dashboard..."
                            : "Sign-in completed. Redirecting you to your dashboard..."),
                    );

                    const roleValue =
                        typeof session.user.role === "string"
                            ? session.user.role
                            : session.user.role != null
                                ? String(session.user.role)
                                : "";

                    const defaultDashboardPath =
                        resolveDashboardPathForRole(roleValue);

                    const safeRedirect =
                        redirectParam && redirectParam.startsWith("/")
                            ? redirectParam
                            : defaultDashboardPath;

                    setRedirectPath(safeRedirect);

                    // Give the user a short moment to read the success message.
                    timeoutId = window.setTimeout(() => {
                        navigate(safeRedirect, { replace: true });
                    }, 1500);
                } else {
                    setStatus("error");
                    setMessage(
                        explicitMessage ??
                        (explicitStatus === "error"
                            ? "We couldn't complete the sign-in process. Please try signing in again."
                            : "We couldn't find an active session after returning from the authentication provider. Please sign in again."),
                    );
                }
            } catch (error) {
                if (!isMounted) return;
                console.error("[auth-callback] Failed to finish auth callback", error);
                const fallbackMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : "Something went wrong while finishing sign-in. Please try again.";
                setStatus("error");
                setMessage(fallbackMessage);
            }
        };

        void finishAuth();

        return () => {
            isMounted = false;
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [navigate, searchParams]);

    const title =
        status === "success"
            ? "You're all set"
            : status === "error"
                ? "We couldn't finish sign-in"
                : "Finishing sign-in";

    const description =
        message ??
        (status === "processing"
            ? "Please wait while we verify your information and complete your eCounseling sign-in. This should only take a moment."
            : status === "success"
                ? "We've successfully verified your account. Redirecting you to your dashboard."
                : "Something went wrong while finishing sign-in. You can safely return to the sign-in page and try again.");

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
                                {status === "success" ? (
                                    <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                                ) : status === "error" ? (
                                    <XCircle className="h-8 w-8 text-destructive" />
                                ) : (
                                    <Loader2 className="h-8 w-8 animate-spin text-amber-800" />
                                )}
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    {title}
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    {description}
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <Button
                                    type="button"
                                    className="w-full max-w-xs"
                                    onClick={() => navigate(redirectPath)}
                                >
                                    {status === "success"
                                        ? "Go to dashboard"
                                        : "Go to sign in"}
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                    {status === "success"
                                        ? "If you aren't redirected automatically, you can use the button above to open your dashboard."
                                        : "If you are not redirected automatically, you can safely click the button above to return to the portal."}
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
