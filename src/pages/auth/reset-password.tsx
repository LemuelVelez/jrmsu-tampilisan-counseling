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
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

const ResetPasswordPage: React.FC = () => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

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

                <div className={cn("flex flex-col gap-6")}>
                    <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                        <CardContent className="grid p-0 md:grid-cols-2">
                            <form
                                className="p-6 md:p-8"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    // TODO: hook up to real reset-password endpoint (with token/identifier)
                                }}
                            >
                                <FieldGroup>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-semibold text-amber-900">
                                            Reset your password
                                        </h1>
                                        <p className="text-sm text-muted-foreground text-balance">
                                            Create a new password for your eCounseling account. Make sure
                                            it&apos;s something secure and easy for you to remember.
                                        </p>
                                    </div>

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
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                aria-label={
                                                    showPassword ? "Hide password" : "Show password"
                                                }
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
                                        <Button type="submit" className="w-full">
                                            Save new password
                                        </Button>
                                    </Field>

                                    <FieldDescription className="text-center text-xs">
                                        Remembered your password?{" "}
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
                        If this reset wasn&apos;t requested by you, please contact the
                        guidance office immediately.
                    </FieldDescription>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
