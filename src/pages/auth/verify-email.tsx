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

const VerifyEmailPage: React.FC = () => {
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
                                    // TODO: hook up to real "resend verification email" endpoint
                                }}
                            >
                                <FieldGroup>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <h1 className="text-2xl font-semibold text-amber-900">
                                            Verify your email
                                        </h1>
                                        <p className="text-sm text-muted-foreground text-balance">
                                            We&apos;ve sent a verification link to your email. Please
                                            check your inbox and click the link to activate your
                                            eCounseling account.
                                        </p>
                                    </div>

                                    <Field>
                                        <FieldLabel htmlFor="verify-email">Email</FieldLabel>
                                        <Input
                                            id="verify-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            required
                                        />
                                        <FieldDescription>
                                            Use the same email you entered when creating your account.
                                        </FieldDescription>
                                    </Field>

                                    <Field>
                                        <Button type="submit" className="w-full">
                                            Resend verification email
                                        </Button>
                                    </Field>

                                    <FieldDescription className="text-center text-xs">
                                        Already verified your email?{" "}
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
