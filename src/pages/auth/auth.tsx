/* eslint-disable @typescript-eslint/no-explicit-any */
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import heroIllustration from "@/assets/images/hero.png";
import ecounselingLogo from "@/assets/images/ecounseling.svg";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/use-session";
import {
    registerAccount,
    type RegisterPayload,
    getCurrentSession,
    clearSession,
} from "@/lib/authentication";
import { toast } from "sonner";
import { resolveDashboardPathForRole } from "@/lib/role";

const YEAR_LEVELS = ["1st", "2nd", "3rd", "4th", "5th"] as const;
type YearLevel = (typeof YEAR_LEVELS)[number];
type YearLevelOption = YearLevel | "Others";

const YEAR_LEVEL_OPTIONS: YearLevelOption[] = [...YEAR_LEVELS, "Others"];

// Colleges and programs used to drive cascaded selects
const COLLEGES: Record<string, string[]> = {
    "College of Business Administration": ["BSBA", "BSAM", "BSHM"],
    "College of Teacher Education": [
        "BSED Filipino",
        "BSED English",
        "BSED Math",
        "BSED Social Studies",
        "Bachelor of Physical Education",
        "BEED",
    ],
    "College of Computing Studies": ["BS Information Systems", "BS Computer Science"],
    "College of Agriculture and Forestry": ["BS Agriculture", "BS Forestry"],
    "College of Liberal Arts, Mathematics and Sciences": ["BAELS"],
    "School of Engineering": ["Agricultural Biosystems Engineering"],
    "School of Criminal Justice Education": ["BS Criminology"],
};

const COLLEGE_ACRONYM: Record<string, string> = {
    "College of Business Administration": "CBA",
    "College of Teacher Education": "CTED",
    "College of Computing Studies": "CCS",
    "College of Agriculture and Forestry": "CAF",
    "College of Liberal Arts, Mathematics and Sciences": "CLAMS",
    "School of Engineering": "SOE",
    "School of Criminal Justice Education": "SCJE",
};

type AuthMode = "login" | "signup";

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
    onSwitchMode: () => void;
}

function isEmailVerified(u: any): boolean {
    if (!u) return false;
    if (u?.email_verified_at) return true;
    if (typeof u?.email_verified === "boolean") return u.email_verified;
    if (typeof u?.verified === "boolean") return u.verified;
    return false;
}

const LoginForm: React.FC<AuthFormProps> = ({
    className,
    onSwitchMode,
    ...props
}) => {
    const navigate = useNavigate();
    const [showLoginPassword, setShowLoginPassword] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { signIn } = useSession();

    const handleSubmit = React.useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(null);
            setIsSubmitting(true);

            const formData = new FormData(event.currentTarget);
            const email = String(formData.get("email") ?? "").trim();
            const password = String(formData.get("password") ?? "");

            if (!email || !password) {
                const msg = "Please enter both your email and password.";
                setFormError(msg);
                toast.error(msg);
                setIsSubmitting(false);
                return;
            }

            try {
                await signIn({ email, password });

                // ✅ After signIn, check the stored session user
                const nextSession = getCurrentSession();
                const user = nextSession.user;

                // ✅ If email is NOT verified: treat login as not successful
                if (!isEmailVerified(user)) {
                    clearSession();

                    toast.info(
                        "Your email is not verified yet. Please verify your email to continue.",
                    );

                    navigate(
                        `/auth/verify-email?email=${encodeURIComponent(email)}`,
                        { replace: true },
                    );
                    return;
                }

                // Successful sign in: AuthPage listens to session changes and will redirect.
                toast.success("Signed in successfully.");
            } catch (error) {
                console.error("[auth] Sign in failed", error);
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "We couldn't sign you in with those credentials. Please try again.";
                setFormError(message);
                toast.error(message);
            } finally {
                setIsSubmitting(false);
            }
        },
        [signIn, navigate],
    );

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-6 md:p-8" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    Sign in to eCounseling
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    Use your email to access the student, counselor, or admin
                                    portal.
                                </p>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                                <Input
                                    id="login-email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                                <div className="relative mt-1">
                                    <Input
                                        id="login-password"
                                        name="password"
                                        type={showLoginPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        required
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                        onClick={() => setShowLoginPassword((prev) => !prev)}
                                        aria-label={
                                            showLoginPassword ? "Hide password" : "Show password"
                                        }
                                    >
                                        {showLoginPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                <div className="mt-1 flex justify-end">
                                    <Link
                                        to="/auth/forgot-password"
                                        className="text-xs underline-offset-2 hover:text-amber-900 hover:underline"
                                    >
                                        Forgot your password?
                                    </Link>
                                </div>
                            </Field>

                            {formError && (
                                <FieldDescription
                                    role="alert"
                                    className="text-xs text-destructive"
                                >
                                    {formError}
                                </FieldDescription>
                            )}

                            <Field>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Signing in..." : "Sign in"}
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
    const navigate = useNavigate();

    const [accountType, setAccountType] = React.useState<"student" | "guest">(
        "student",
    );
    const [gender, setGender] = React.useState<string>("");
    const [yearLevel, setYearLevel] = React.useState<YearLevelOption | "">("");
    const [yearLevelOther, setYearLevelOther] = React.useState<string>("");

    const [selectedProgram, setSelectedProgram] = React.useState<string>("");
    const [programOther, setProgramOther] = React.useState<string>("");

    const [selectedCourse, setSelectedCourse] = React.useState<string>("");
    const [courseOther, setCourseOther] = React.useState<string>("");

    const [showSignupPassword, setShowSignupPassword] = React.useState(false);
    const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
        React.useState(false);

    const [formError, setFormError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const coursesForSelectedProgram = selectedProgram
        ? COLLEGES[selectedProgram] ?? []
        : [];

    const handleSubmit = React.useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(null);
            setIsSubmitting(true);

            const formData = new FormData(event.currentTarget);
            const name = String(formData.get("name") ?? "").trim();
            const email = String(formData.get("email") ?? "").trim();
            const password = String(formData.get("password") ?? "");
            const passwordConfirmation = String(
                formData.get("password_confirmation") ?? "",
            );

            if (!name) {
                const msg = "Please enter your full name.";
                setFormError(msg);
                toast.error(msg);
                setIsSubmitting(false);
                return;
            }

            if (!email) {
                const msg = "Please enter your email address.";
                setFormError(msg);
                toast.error(msg);
                setIsSubmitting(false);
                return;
            }

            if (!password || !passwordConfirmation) {
                const msg = "Please enter and confirm your password.";
                setFormError(msg);
                toast.error(msg);
                setIsSubmitting(false);
                return;
            }

            if (password !== passwordConfirmation) {
                const msg = "Passwords do not match. Please double-check them.";
                setFormError(msg);
                toast.error(msg);
                setIsSubmitting(false);
                return;
            }

            const studentId = String(formData.get("studentId") ?? "").trim();

            const resolvedYearLevel =
                yearLevel === "Others"
                    ? yearLevelOther.trim()
                    : (yearLevel || "").toString().trim();

            const resolvedProgram =
                selectedProgram === "Others"
                    ? programOther.trim()
                    : selectedProgram.trim();

            const resolvedCourse =
                selectedCourse === "Others"
                    ? courseOther.trim()
                    : selectedCourse.trim();

            const registerPayload: RegisterPayload = {
                name,
                email,
                password,
                password_confirmation: passwordConfirmation,
                gender: gender || undefined,
                account_type: accountType,
                student_id:
                    accountType === "student" && studentId ? studentId : undefined,
                year_level:
                    accountType === "student" && resolvedYearLevel
                        ? resolvedYearLevel
                        : undefined,
                program:
                    accountType === "student" && resolvedProgram
                        ? resolvedProgram
                        : undefined,
                course:
                    accountType === "student" && resolvedCourse
                        ? resolvedCourse
                        : undefined,
            };

            try {
                await registerAccount(registerPayload);
                toast.success(
                    "Account created. Please check your email for a verification link.",
                );
                navigate(`/auth/verify-email?email=${encodeURIComponent(email)}`);
            } catch (error) {
                console.error("[auth] Registration failed", error);
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "We couldn't create your account with the provided details. Please try again.";
                setFormError(message);
                toast.error(message);
            } finally {
                setIsSubmitting(false);
            }
        },
        [
            accountType,
            gender,
            yearLevel,
            yearLevelOther,
            selectedProgram,
            programOther,
            selectedCourse,
            courseOther,
            navigate,
        ],
    );

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0 border-amber-100/90 bg-white/90 shadow-md shadow-amber-100/80 backdrop-blur">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-6 md:p-8" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-semibold text-amber-900">
                                    Create your eCounseling account
                                </h1>
                                <p className="text-sm text-muted-foreground text-balance">
                                    Enter your name and email to set up your account.
                                </p>
                            </div>

                            <Field>
                                <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
                                <Input
                                    id="signup-name"
                                    name="name"
                                    type="text"
                                    placeholder="Juan Dela Cruz"
                                    autoComplete="name"
                                    required
                                />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                                <Input
                                    id="signup-email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                />
                                <FieldDescription>
                                    We&apos;ll use this personal email to contact you about
                                    counseling updates and appointments. Your email will not be
                                    shared.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field>
                                        <FieldLabel htmlFor="signup-gender">Gender</FieldLabel>
                                        <Select
                                            value={gender}
                                            onValueChange={(value) => setGender(value)}
                                        >
                                            <SelectTrigger id="signup-gender">
                                                <SelectValue placeholder="Select gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="nonbinary">Non-binary</SelectItem>
                                                <SelectItem value="prefer-not-to-say">
                                                    Prefer not to say
                                                </SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor="signup-account-type">
                                            Registration type
                                        </FieldLabel>
                                        <Select
                                            value={accountType}
                                            onValueChange={(value) =>
                                                setAccountType(value as "student" | "guest")
                                            }
                                        >
                                            <SelectTrigger id="signup-account-type">
                                                <SelectValue placeholder="Select registration type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="student">Student</SelectItem>
                                                <SelectItem value="guest">Guest</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                            </Field>

                            {accountType === "student" && (
                                <Field>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field>
                                            <FieldLabel htmlFor="signup-student-id">
                                                Student ID
                                            </FieldLabel>
                                            <Input
                                                id="signup-student-id"
                                                name="studentId"
                                                placeholder="TC-23-B-00123"
                                            />
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="signup-year-level">
                                                Year level
                                            </FieldLabel>
                                            <Select
                                                value={yearLevel}
                                                onValueChange={(value) =>
                                                    setYearLevel(value as YearLevelOption)
                                                }
                                            >
                                                <SelectTrigger id="signup-year-level">
                                                    <SelectValue placeholder="Select year level" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {YEAR_LEVEL_OPTIONS.map((level) => (
                                                        <SelectItem key={level} value={level}>
                                                            {level === "Others"
                                                                ? "Others (please specify)"
                                                                : level}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {yearLevel === "Others" && (
                                                <div className="mt-2">
                                                    <FieldLabel
                                                        htmlFor="signup-year-level-other"
                                                        className="sr-only"
                                                    >
                                                        Please specify year level
                                                    </FieldLabel>
                                                    <Input
                                                        id="signup-year-level-other"
                                                        placeholder="Please specify your year level"
                                                        value={yearLevelOther}
                                                        onChange={(e) =>
                                                            setYearLevelOther(e.target.value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Field>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field>
                                            <FieldLabel htmlFor="signup-program">Program</FieldLabel>
                                            <Select
                                                value={selectedProgram}
                                                onValueChange={(value) => {
                                                    setSelectedProgram(value);
                                                    setSelectedCourse("");
                                                    setCourseOther("");
                                                }}
                                            >
                                                <SelectTrigger id="signup-program">
                                                    <SelectValue placeholder="Select program" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.keys(COLLEGES).map((collegeName) => {
                                                        const acronym = COLLEGE_ACRONYM[collegeName];
                                                        return (
                                                            <SelectItem
                                                                key={collegeName}
                                                                value={collegeName}
                                                            >
                                                                {collegeName}
                                                                {acronym ? ` (${acronym})` : ""}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                    <SelectItem value="Others">
                                                        Others (please specify)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {selectedProgram === "Others" && (
                                                <div className="mt-2">
                                                    <FieldLabel
                                                        htmlFor="signup-program-other"
                                                        className="sr-only"
                                                    >
                                                        Please specify program
                                                    </FieldLabel>
                                                    <Input
                                                        id="signup-program-other"
                                                        placeholder="Please specify your program"
                                                        value={programOther}
                                                        onChange={(e) =>
                                                            setProgramOther(e.target.value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Field>

                                        <Field>
                                            <FieldLabel htmlFor="signup-course">Course</FieldLabel>
                                            <Select
                                                value={selectedCourse}
                                                onValueChange={(value) => setSelectedCourse(value)}
                                                disabled={!selectedProgram}
                                            >
                                                <SelectTrigger id="signup-course">
                                                    <SelectValue
                                                        placeholder={
                                                            selectedProgram
                                                                ? "Select course"
                                                                : "Select a program first"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {coursesForSelectedProgram.map((course) => (
                                                        <SelectItem key={course} value={course}>
                                                            {course}
                                                        </SelectItem>
                                                    ))}
                                                    {selectedProgram && (
                                                        <SelectItem value="Others">
                                                            Others (please specify)
                                                        </SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            {selectedCourse === "Others" && (
                                                <div className="mt-2">
                                                    <FieldLabel
                                                        htmlFor="signup-course-other"
                                                        className="sr-only"
                                                    >
                                                        Please specify course
                                                    </FieldLabel>
                                                    <Input
                                                        id="signup-course-other"
                                                        placeholder="Please specify your course"
                                                        value={courseOther}
                                                        onChange={(e) =>
                                                            setCourseOther(e.target.value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Field>
                                    </div>
                                </Field>
                            )}

                            <Field>
                                <Field className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field>
                                        <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                                        <div className="relative">
                                            <Input
                                                id="signup-password"
                                                name="password"
                                                type={showSignupPassword ? "text" : "password"}
                                                placeholder="Create a password"
                                                autoComplete="new-password"
                                                required
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                                onClick={() =>
                                                    setShowSignupPassword((prev) => !prev)
                                                }
                                                aria-label={
                                                    showSignupPassword ? "Hide password" : "Show password"
                                                }
                                            >
                                                {showSignupPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="signup-confirm-password">
                                            Confirm password
                                        </FieldLabel>
                                        <div className="relative">
                                            <Input
                                                id="signup-confirm-password"
                                                name="password_confirmation"
                                                type={showSignupConfirmPassword ? "text" : "password"}
                                                placeholder="Re-enter your password"
                                                autoComplete="new-password"
                                                required
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute inset-y-0 right-0 flex items-center justify-center hover:bg-transparent"
                                                onClick={() =>
                                                    setShowSignupConfirmPassword((prev) => !prev)
                                                }
                                                aria-label={
                                                    showSignupConfirmPassword ? "Hide password" : "Show password"
                                                }
                                            >
                                                {showSignupConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                    </Field>
                                </Field>
                                <FieldDescription>Must be at least 8 characters long.</FieldDescription>
                                {formError && (
                                    <FieldDescription
                                        role="alert"
                                        className="text-xs text-destructive"
                                    >
                                        {formError}
                                    </FieldDescription>
                                )}
                            </Field>

                            <Field>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Creating account..." : "Create account"}
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
    const { session, status } = useSession();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (status !== "authenticated" || !session.user) {
            return;
        }

        // ✅ If user is authenticated but email is not verified, force verify flow.
        if (!isEmailVerified(session.user)) {
            const email =
                typeof session.user.email === "string" ? session.user.email : "";
            clearSession();
            navigate(`/auth/verify-email?email=${encodeURIComponent(email)}`, {
                replace: true,
            });
            return;
        }

        // Only auto-redirect after a successful sign-in.
        // After registration we manually send the user to the verify-email page.
        if (mode !== "login") {
            return;
        }

        const roleValue =
            typeof session.user.role === "string"
                ? session.user.role
                : session.user.role != null
                    ? String(session.user.role)
                    : "";

        const dashboardPath = resolveDashboardPathForRole(roleValue);
        navigate(dashboardPath, { replace: true });
    }, [status, session, navigate, mode]);

    return (
        <div className="min-h-screen bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60 px-4 py-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
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
