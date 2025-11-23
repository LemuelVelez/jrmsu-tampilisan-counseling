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

type AuthMode = "login" | "signup";

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
    onSwitchMode: () => void;
}

const LoginForm: React.FC<AuthFormProps> = ({
    className,
    onSwitchMode,
    ...props
}) => {
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form
                        className="p-6 md:p-8"
                        onSubmit={(event) => {
                            event.preventDefault();
                            // TODO: hook up to real auth endpoint
                        }}
                    >
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    Sign in to eCounseling
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    Use your JRMSU account to access the student, counselor, or
                                    admin portal.
                                </p>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="login-email">JRMSU email</FieldLabel>
                                <Input
                                    id="login-email"
                                    type="email"
                                    placeholder="name@jrmsu.edu"
                                    required
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="login-password">Password</FieldLabel>
                                    <a
                                        href="#"
                                        className="ml-auto text-xs underline-offset-2 hover:text-amber-900 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>
                                </div>
                                <Input id="login-password" type="password" required />
                            </Field>

                            <Field>
                                <Button type="submit" className="w-full">
                                    Sign in
                                </Button>
                            </Field>

                            <FieldDescription className="text-center text-xs">
                                Don&apos;t have an account?{" "}
                                <button
                                    type="button"
                                    onClick={onSwitchMode}
                                    className="font-medium text-amber-900 underline-offset-2 hover:underline"
                                >
                                    Create one
                                </button>
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
                By continuing, you agree to follow JRMSU&apos;s acceptable use policies
                and data privacy guidelines.
            </FieldDescription>
        </div>
    );
};

const SignupForm: React.FC<AuthFormProps> = ({
    className,
    onSwitchMode,
    ...props
}) => {
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form
                        className="p-6 md:p-8"
                        onSubmit={(event) => {
                            event.preventDefault();
                            // TODO: hook up to real signup endpoint
                        }}
                    >
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    Create your eCounseling account
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    Enter your JRMSU email to set up your account.
                                </p>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="signup-email">JRMSU email</FieldLabel>
                                <Input
                                    id="signup-email"
                                    type="email"
                                    placeholder="name@jrmsu.edu"
                                    required
                                />
                                <FieldDescription>
                                    We&apos;ll use this to contact you about counseling updates
                                    and appointments. Your email will not be shared.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Field className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field>
                                        <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                                        <Input id="signup-password" type="password" required />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="signup-confirm-password">
                                            Confirm password
                                        </FieldLabel>
                                        <Input
                                            id="signup-confirm-password"
                                            type="password"
                                            required
                                        />
                                    </Field>
                                </Field>
                                <FieldDescription>
                                    Must be at least 8 characters long.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <Button type="submit" className="w-full">
                                    Create account
                                </Button>
                            </Field>

                            <FieldDescription className="text-center text-xs">
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={onSwitchMode}
                                    className="font-medium text-amber-900 underline-offset-2 hover:underline"
                                >
                                    Sign in
                                </button>
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
                By creating an account, you agree to follow JRMSU&apos;s acceptable use
                policies and data privacy guidelines.
            </FieldDescription>
        </div>
    );
};

const AuthPage: React.FC = () => {
    const [mode, setMode] = React.useState<AuthMode>("login");

    return (
        <div className="min-h-screen bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60 px-4 py-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
                {/* Simple header without toggle tabs */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-semibold tracking-tight text-amber-900">
                            eCounseling Portal
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            JRMSU – Tampilisan Campus
                        </p>
                    </div>
                </div>

                {mode === "login" ? (
                    <LoginForm onSwitchMode={() => setMode("signup")} />
                ) : (
                    <SignupForm onSwitchMode={() => setMode("login")} />
                )}
            </div>
        </div>
    );
};

export default AuthPage;
