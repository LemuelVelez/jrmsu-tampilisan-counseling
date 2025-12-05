import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import heroIllustration from "@/assets/images/hero.png";
import ecounselingLogo from "@/assets/images/ecounseling.svg";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "@/hooks/use-session";
import { AUTH_API_BASE_URL } from "@/api/auth/route";
import { toast } from "sonner";

async function resendVerificationEmailRequest(email: string): Promise<void> {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "The API base URL is not configured. Please set VITE_API_LARAVEL_BASE_URL in your .env file.",
        );
    }

    // Backend route that should send a new verification email.
    const url = `${AUTH_API_BASE_URL}/auth/email/resend-verification`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        let message =
            "We couldn't resend the verification email right now. Please try again in a moment.";

        try {
            const data = await response.json();
            if (data && typeof data === "object" && "message" in data) {
                const anyData = data as { message?: unknown };
                if (typeof anyData.message === "string" && anyData.message.trim()) {
                    message = anyData.message;
                }
            }
        } catch {
            // Ignore JSON parse errors and use the fallback message.
        }

        throw new Error(message);
    }
}

const VerifyEmailPage: React.FC = () => {
    const { session } = useSession();
    const [searchParams] = useSearchParams();

    const [email, setEmail] = React.useState<string>(() => {
        const fromQuery = searchParams.get("email");
        if (fromQuery) return fromQuery;
        if (session?.user?.email) return session.user.email;
        return "";
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fromQuery = searchParams.get("email");
        const sessionEmail = session?.user?.email ?? "";

        if (fromQuery && fromQuery !== email) {
            setEmail(fromQuery);
            return;
        }

        if (!fromQuery && sessionEmail && sessionEmail !== email) {
            setEmail(sessionEmail);
        }
    }, [searchParams, session, email]);

    const handleSubmit = React.useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(null);
            setFormSuccess(null);

            const trimmedEmail = email.trim();

            if (!trimmedEmail) {
                const msg =
                    "Please enter the email address associated with your account.";
                setFormError(msg);
                toast.error(msg);
                return;
            }

            setIsSubmitting(true);

            try {
                await resendVerificationEmailRequest(trimmedEmail);

                const successMsg =
                    "If an account exists for this email, we've just sent a new verification link. Please check your inbox.";
                setFormSuccess(successMsg);
                toast.success("Verification email sent. Please check your inbox.");
            } catch (error) {
                console.error(
                    "[verify-email] Failed to resend verification email",
                    error,
                );
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "We couldn't resend the verification email right now. Please try again later.";
                setFormError(message);
                toast.error(message);
            } finally {
                setIsSubmitting(false);
            }
        },
        [email],
    );

    return (
        <div className="min-h-screen bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60 px-4 py-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
                {/* Header with logo (clickable back to landing page) */}
                <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                        to="/"
                        className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3"
                    >
                        <img
                            src={ecounselingLogo}
                            alt="eCounseling logo"
                            className="h-8 w-auto"
                        />
                        <div className="flex flex-col text-center sm:text-left">
                            <h1 className="text-lg font-semibold tracking-tight text-amber-900">
                                eCounseling Portal
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                JRMSU – Tampilisan Campus
                            </p>
                        </div>
                    </Link>
                </div>

                <div className={cn("flex flex-col gap-6")}>
                    <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                        <CardContent className="grid p-0 md:grid-cols-2">
                            <form className="p-6 md:p-8" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-semibold text-amber-900">
                                            Verify your email
                                        </h1>
                                        <p className="text-sm text-muted-foreground text-balance">
                                            We&apos;ve sent a verification link to your email.
                                            Please check your inbox and click the link to activate
                                            your eCounseling account.
                                        </p>
                                    </div>

                                    <Field>
                                        <FieldLabel htmlFor="verify-email">Email</FieldLabel>
                                        <Input
                                            id="verify-email"
                                            name="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(event) =>
                                                setEmail(event.target.value)
                                            }
                                        />
                                        <FieldDescription>
                                            Use the same email you entered when creating your
                                            account.
                                        </FieldDescription>
                                        {formError && (
                                            <FieldDescription
                                                role="alert"
                                                className="mt-1 text-xs text-destructive"
                                            >
                                                {formError}
                                            </FieldDescription>
                                        )}
                                        {formSuccess && (
                                            <FieldDescription
                                                role="status"
                                                className="mt-1 text-xs text-emerald-700"
                                            >
                                                {formSuccess}
                                            </FieldDescription>
                                        )}
                                    </Field>

                                    <Field>
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting
                                                ? "Sending..."
                                                : "Resend verification email"}
                                        </Button>
                                    </Field>

                                    <FieldDescription className="text-center text-xs flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
                                        <span>Already verified your email?</span>
                                        <Link
                                            to="/auth"
                                            className="font-medium text-amber-900 underline-offset-2 hover:underline"
                                        >
                                            Back to sign in
                                        </Link>
                                    </FieldDescription>
                                </FieldGroup>
                            </form>

                            <div className="bg-muted relative hidden md:block">
                                <img
                                    src={heroIllustration}
                                    alt="JRMSU student using the eCounseling platform"
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
                        Didn&apos;t receive the email? Check your spam or promotions
                        folder, or contact the guidance office for further assistance.
                    </FieldDescription>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
