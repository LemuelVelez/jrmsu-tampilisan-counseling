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
import { Link } from "react-router-dom";
import {
    forgotPasswordApi,
    type ApiError,
} from "@/api/auth/route";

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = React.useState("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(
        null,
    );

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Please enter your email address.");
            setSuccessMessage(null);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await forgotPasswordApi({ email: trimmedEmail });

            setSuccessMessage(
                response.message ||
                "If an account exists for this email, we have sent a password reset link.",
            );
        } catch (err) {
            const apiError = err as ApiError;
            setError(
                apiError.message ||
                "We couldn’t send a reset link right now. Please try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

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
                            <form
                                className="p-6 md:p-8"
                                onSubmit={handleSubmit}
                            >
                                <FieldGroup>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-semibold text-amber-900">
                                            Forgot your password?
                                        </h1>
                                        <p className="text-sm text-muted-foreground text-balance">
                                            Enter the email associated with your eCounseling account
                                            and we&apos;ll send you a link to reset your password.
                                        </p>
                                    </div>

                                    <Field>
                                        <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                                        <Input
                                            id="forgot-email"
                                            name="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            required
                                            value={email}
                                            onChange={(event) =>
                                                setEmail(event.target.value)
                                            }
                                        />
                                        <FieldDescription>
                                            Make sure this is the same email you used when creating
                                            your account.
                                        </FieldDescription>
                                    </Field>

                                    <Field>
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting
                                                ? "Sending reset link..."
                                                : "Send reset link"}
                                        </Button>
                                    </Field>

                                    {error && (
                                        <FieldDescription className="text-center text-xs text-red-600">
                                            {error}
                                        </FieldDescription>
                                    )}

                                    {successMessage && (
                                        <FieldDescription className="text-center text-xs text-emerald-600">
                                            {successMessage}
                                        </FieldDescription>
                                    )}

                                    <FieldDescription className="text-center text-xs flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
                                        <span>Remember your password?</span>
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
                        If you no longer have access to your email, please contact the
                        guidance office for assistance.
                    </FieldDescription>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
