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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import heroIllustration from "@/assets/images/hero.png";
import appLogo from "@/assets/images/ecounseling.svg";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { resetPasswordApi, type ApiError } from "@/api/auth/route";

const APP_NAME = "E-Guidance Appointment System";

const ResetPasswordPage: React.FC = () => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(
        null,
    );

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const token = searchParams.get("token") ?? "";
    const email = searchParams.get("email") ?? "";

    const hasValidToken = Boolean(token && email);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!hasValidToken) {
            const message =
                "This reset link is invalid or missing information. Please request a new one.";
            setError(message);
            setSuccessMessage(null);
            toast.error(message);
            return;
        }

        if (!password || !confirmPassword) {
            const message = "Please fill in both password fields.";
            setError(message);
            setSuccessMessage(null);
            toast.error(message);
            return;
        }

        if (password !== confirmPassword) {
            const message = "Passwords do not match.";
            setError(message);
            setSuccessMessage(null);
            toast.error(message);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await resetPasswordApi({
                token,
                email,
                password,
                password_confirmation: confirmPassword,
            });

            const message =
                response.message ||
                "Your password has been reset. Redirecting to sign in…";

            setSuccessMessage(message);
            toast.success("Your password has been reset. You can now sign in.");

            // Redirect back to sign-in after a short moment
            setTimeout(() => {
                navigate("/auth");
            }, 1500);
        } catch (err) {
            const apiError = err as ApiError;
            const message =
                apiError.message ||
                "We couldn’t reset your password right now. Please try again.";

            setError(message);
            toast.error(message);
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
                            src={appLogo}
                            alt={`${APP_NAME} logo`}
                            className="h-8 w-auto"
                        />
                        <div className="flex flex-col text-center sm:text-left">
                            <h1 className="text-lg font-semibold tracking-tight text-amber-900">
                                {APP_NAME}
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
                                            Reset your password
                                        </h1>
                                        <p className="text-sm text-muted-foreground text-balance">
                                            Create a new password for your {APP_NAME} account. Make
                                            sure it&apos;s something secure and easy for you to
                                            remember.
                                        </p>
                                        {email && (
                                            <p className="text-xs text-muted-foreground">
                                                Resetting password for{" "}
                                                <span className="font-medium text-amber-900">
                                                    {email}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Invalid/expired link alert */}
                                    {!hasValidToken && (
                                        <Alert
                                            variant="destructive"
                                            className="text-left"
                                        >
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>
                                                Invalid or expired link
                                            </AlertTitle>
                                            <AlertDescription>
                                                This reset link is invalid or has expired. Please
                                                request a new password reset from the
                                                &quot;Forgot password&quot; page.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {/* Dynamic error/success alerts */}
                                    {error && (
                                        <Alert
                                            variant="destructive"
                                            className="text-left"
                                        >
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Something went wrong</AlertTitle>
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {successMessage && (
                                        <Alert className="border-emerald-200 bg-emerald-50/80 text-left">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                                            <AlertTitle className="text-emerald-800">
                                                Password updated
                                            </AlertTitle>
                                            <AlertDescription className="text-emerald-800/90">
                                                {successMessage}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <Field>
                                        <FieldLabel htmlFor="reset-password">
                                            New password
                                        </FieldLabel>
                                        <div className="relative">
                                            <Input
                                                id="reset-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Create a new password"
                                                required
                                                className="pr-10"
                                                value={password}
                                                onChange={(event) =>
                                                    setPassword(event.target.value)
                                                }
                                                disabled={!hasValidToken || isSubmitting}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                                onClick={() =>
                                                    setShowPassword((prev) => !prev)
                                                }
                                                aria-label={
                                                    showPassword ? "Hide password" : "Show password"
                                                }
                                                tabIndex={-1}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="reset-confirm-password">
                                            Confirm new password
                                        </FieldLabel>
                                        <div className="relative">
                                            <Input
                                                id="reset-confirm-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Re-enter your new password"
                                                required
                                                className="pr-10"
                                                value={confirmPassword}
                                                onChange={(event) =>
                                                    setConfirmPassword(event.target.value)
                                                }
                                                disabled={!hasValidToken || isSubmitting}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                                onClick={() =>
                                                    setShowConfirmPassword((prev) => !prev)
                                                }
                                                aria-label={
                                                    showConfirmPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <FieldDescription>
                                            Must be at least 8 characters long.
                                        </FieldDescription>
                                    </Field>

                                    <Field>
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={!hasValidToken || isSubmitting}
                                        >
                                            {isSubmitting
                                                ? "Saving new password..."
                                                : "Save new password"}
                                        </Button>
                                    </Field>

                                    <FieldDescription className="text-center text-xs flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
                                        <span>Remembered your password?</span>
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
                                    alt={`JRMSU user using the ${APP_NAME}`}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
                        If this reset wasn&apos;t requested by you, please contact the
                        guidance office immediately.
                    </FieldDescription>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
