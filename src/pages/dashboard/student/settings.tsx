/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    getCurrentSession,
    subscribeToSession,
    uploadCurrentUserAvatar,
    fetchCurrentUserFromServer,
    type AuthSession,
} from "@/lib/authentication";
import { normalizeRole } from "@/lib/role";
import { AUTH_API_BASE_URL } from "@/api/auth/route";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    UploadCloud,
    ImageOff,
    Eye,
    EyeOff,
    Save,
} from "lucide-react";

const MAX_AVATAR_SIZE_MB = 5;
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

const getInitials = (name?: string | null): string => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`
        .toUpperCase()
        .slice(0, 2);
};

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error(
            "VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.",
        );
    }
    const trimmedPath = path.replace(/^\/+/, "");
    return `${AUTH_API_BASE_URL}/${trimmedPath}`;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = resolveApiUrl(path);

    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
        credentials: "include",
    });

    const text = await response.text();
    let data: unknown = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const body = data as any;

        const firstErrorFromLaravel =
            body?.errors && typeof body.errors === "object"
                ? (Object.values(body.errors)[0] as any)?.[0]
                : undefined;

        const message =
            body?.message ||
            body?.error ||
            firstErrorFromLaravel ||
            response.statusText ||
            "An unknown error occurred while communicating with the server.";

        const err = new Error(message) as any;
        err.status = response.status;
        err.data = body ?? text;
        throw err;
    }

    return data as T;
}

async function updateProfileOnServer(payload: any): Promise<any> {
    // Primary (based on your avatar endpoint: /student/profile/avatar)
    try {
        return await apiFetch<any>("/student/profile", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    } catch (err: any) {
        // Optional fallback (in case backend uses a different profile route)
        const status = err?.status;
        if (status === 404 || status === 405) {
            return await apiFetch<any>("/profile", {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        }
        throw err;
    }
}

type ProfileForm = {
    name: string;
    email: string;
    gender: string; // "" when not selected
    student_id: string;
    year_level: string;
    program: string;
    course: string;
};

const EMPTY_PROFILE: ProfileForm = {
    name: "",
    email: "",
    gender: "",
    student_id: "",
    year_level: "",
    program: "",
    course: "",
};

function readStr(obj: any, key: string): string {
    const v = obj?.[key];
    if (v == null) return "";
    return String(v);
}

const ALLOWED_GENDERS = new Set([
    "male",
    "female",
    "nonbinary",
    "prefer-not-to-say",
    "other",
]);

function normalizeGenderFromDb(raw: string): string {
    const s = String(raw ?? "").trim();
    if (!s) return "";

    const compact = s.toLowerCase().trim().replace(/[\s_]+/g, "-");

    // Already valid
    if (ALLOWED_GENDERS.has(compact)) return compact;

    // Common variations
    if (["m", "man", "boy"].includes(compact)) return "male";
    if (["f", "woman", "girl"].includes(compact)) return "female";
    if (["non-binary", "nb"].includes(compact)) return "nonbinary";

    const cleaned = compact.replace(/[^a-z-]/g, "");
    if (
        [
            "prefer-not-to-say",
            "prefernottosay",
            "rather-not-say",
            "donotwanttosay",
            "dont-want-to-say",
            "dontwanttosay",
            "na",
            "n-a",
        ].includes(cleaned)
    ) {
        return "prefer-not-to-say";
    }

    if (["others"].includes(compact)) return "other";

    // Unknown value — keep it so it can still be shown in the Select.
    return s;
}

function userToProfileForm(u: any): ProfileForm {
    return {
        name: readStr(u, "name"),
        email: readStr(u, "email"),
        gender: normalizeGenderFromDb(readStr(u, "gender")),
        student_id: readStr(u, "student_id"),
        year_level: readStr(u, "year_level"),
        program: readStr(u, "program"),
        course: readStr(u, "course"),
    };
}

function isEmailVerified(u: any): boolean {
    if (u?.email_verified_at) return true;
    if (typeof u?.email_verified === "boolean") return u.email_verified;
    if (typeof u?.verified === "boolean") return u.verified;
    return false;
}

function sameProfile(a: ProfileForm | null, b: ProfileForm | null): boolean {
    if (!a || !b) return false;
    return (
        a.name === b.name &&
        a.email === b.email &&
        a.gender === b.gender &&
        a.student_id === b.student_id &&
        a.year_level === b.year_level &&
        a.program === b.program &&
        a.course === b.course
    );
}

const StudentSettings: React.FC = () => {
    const [session, setSession] = React.useState<AuthSession>(() => getCurrentSession());
    const user = session.user as any;

    const roleNorm = normalizeRole(user?.role ?? "");
    const isStudentRole = roleNorm.includes("student");
    const emailVerified = user ? isEmailVerified(user) : false;

    // Ensure initial form (including gender) is based on session immediately
    const [profileOriginal, setProfileOriginal] = React.useState<ProfileForm | null>(() => {
        const u = getCurrentSession().user as any;
        return u ? userToProfileForm(u) : null;
    });

    const [profileForm, setProfileForm] = React.useState<ProfileForm>(() => {
        const u = getCurrentSession().user as any;
        return u ? userToProfileForm(u) : { ...EMPTY_PROFILE };
    });

    // Extract primitives for stable deps (eslint)
    const userId = String(user?.id ?? "");
    const userName = String(user?.name ?? "");
    const userEmail = String(user?.email ?? "");
    const userGender = String(user?.gender ?? "");
    const userStudentId = String(user?.student_id ?? "");
    const userYearLevel = String(user?.year_level ?? "");
    const userProgram = String(user?.program ?? "");
    const userCourse = String(user?.course ?? "");
    const userRole = String(user?.role ?? "");
    const userEmailVerifiedAt = String(user?.email_verified_at ?? "");
    const userEmailVerified = String(user?.email_verified ?? "");
    const userVerified = String(user?.verified ?? "");

    // Password
    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [isChangingPassword, setIsChangingPassword] = React.useState(false);

    const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

    // Avatar
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

    const [isSavingProfile, setIsSavingProfile] = React.useState(false);

    // Prevent overwriting user edits while session refreshes
    const dirtyRef = React.useRef(false);

    const profileDirty = React.useMemo(() => {
        if (!profileOriginal) return false;
        return !sameProfile(profileOriginal, profileForm);
    }, [profileOriginal, profileForm]);

    React.useEffect(() => {
        dirtyRef.current = profileDirty;
    }, [profileDirty]);

    // Subscribe once
    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });
        return unsubscribe;
    }, []);

    // IMPORTANT: refresh from DB on mount so gender comes from database (not stale localStorage)
    React.useEffect(() => {
        // fetchCurrentUserFromServer handles errors internally and updates session via setSession()
        void fetchCurrentUserFromServer();
    }, []);

    const userSnapshotKey = React.useMemo(() => {
        return [
            userId,
            userName,
            userEmail,
            userGender,
            userStudentId,
            userYearLevel,
            userProgram,
            userCourse,
            userRole,
            userEmailVerifiedAt,
            userEmailVerified,
            userVerified,
        ].join("|");
    }, [
        userId,
        userName,
        userEmail,
        userGender,
        userStudentId,
        userYearLevel,
        userProgram,
        userCourse,
        userRole,
        userEmailVerifiedAt,
        userEmailVerified,
        userVerified,
    ]);

    // Sync form from session/DB (but don't overwrite dirty edits)
    React.useEffect(() => {
        if (!user) return;

        const next = userToProfileForm(user);

        setProfileOriginal((prevOriginal) => {
            if (prevOriginal == null) {
                setProfileForm(next);
                return next;
            }

            if (dirtyRef.current) return prevOriginal;

            setProfileForm(next);
            return next;
        });
    }, [userSnapshotKey, user]);

    const existingAvatarUrl =
        user?.avatar_url && typeof user.avatar_url === "string"
            ? (user.avatar_url as string)
            : null;

    const displayAvatarUrl = avatarPreviewUrl || existingAvatarUrl || null;

    React.useEffect(() => {
        return () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        };
    }, [avatarPreviewUrl]);

    const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file (JPG, PNG, etc.).");
            event.target.value = "";
            return;
        }

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            toast.error(`Image is too large. Maximum size is ${MAX_AVATAR_SIZE_MB} MB.`);
            event.target.value = "";
            return;
        }

        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);

        const preview = URL.createObjectURL(file);
        setAvatarFile(file);
        setAvatarPreviewUrl(preview);
    };

    const handleUploadAvatar = async () => {
        if (!avatarFile) {
            toast.error("Please choose an image first.");
            return;
        }

        setIsUploadingAvatar(true);

        try {
            const result = await uploadCurrentUserAvatar(avatarFile);

            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(null);
            setAvatarFile(null);

            toast.success(result.raw.message ?? "Your profile picture has been updated.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to upload avatar. Please try again.";
            toast.error(message);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleClearAvatar = () => {
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
    };

    const handleSaveProfile = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!user) {
            toast.error("You are not logged in.");
            return;
        }

        const name = profileForm.name.trim();
        const email = profileForm.email.trim();
        const gender = profileForm.gender.trim();

        if (!name) {
            toast.error("Please enter your name.");
            return;
        }
        if (!email) {
            toast.error("Please enter your email.");
            return;
        }

        const originalEmail = (profileOriginal?.email ?? "").trim();
        const emailChanged = originalEmail !== "" && originalEmail !== email;

        const payload: any = {
            name,
            email,
            ...(gender ? { gender } : { gender: "" }),
        };

        if (isStudentRole) {
            payload.student_id = profileForm.student_id.trim();
            payload.year_level = profileForm.year_level.trim();
            payload.program = profileForm.program.trim();
            payload.course = profileForm.course.trim();
        }

        setIsSavingProfile(true);

        try {
            const res = await updateProfileOnServer(payload);

            toast.success(res?.message ?? "Profile updated successfully.");

            if (emailChanged) {
                toast.info(
                    "Your email was changed. It will be marked as unverified and must be verified to complete the change.",
                );
            }

            await fetchCurrentUserFromServer();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to update profile.";
            toast.error(msg);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!currentPassword.trim() || !newPassword.trim()) {
            toast.error("Please fill in all password fields.");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation do not match.");
            return;
        }

        setIsChangingPassword(true);

        try {
            await new Promise((resolve) => setTimeout(resolve, 800));
            toast.success(
                "Password change submitted (simulated). Once backend is ready, this will securely update your password.",
            );

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to change password. Please try again.";
            toast.error(message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const initials = getInitials(user?.name ?? user?.email ?? "User");

    // If DB has a value we don't support, keep it visible so it stays selected
    const genderNotInList =
        !!profileForm.gender && !ALLOWED_GENDERS.has(profileForm.gender);

    return (
        <DashboardLayout
            title="Settings"
            description="Manage your account details, password, and profile picture."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-3xl space-y-6">
                    {/* PROFILE HEADER */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="flex w-full justify-center sm:w-auto sm:justify-start">
                                <Avatar className="h-16 w-16 border border-amber-100 bg-amber-50">
                                    {displayAvatarUrl ? (
                                        <AvatarImage
                                            src={displayAvatarUrl}
                                            alt={user?.name ?? "Profile picture"}
                                            className="object-cover"
                                        />
                                    ) : (
                                        <AvatarFallback className="bg-amber-100 text-sm font-semibold text-amber-900">
                                            {initials}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                            </div>

                            <div className="space-y-1 text-center sm:text-left">
                                <CardTitle className="text-base font-semibold text-amber-900">
                                    {user?.name ?? "Your account"}
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    {user?.email ?? "—"}
                                </CardDescription>

                                <p className="text-[0.7rem] text-muted-foreground">
                                    Email status:{" "}
                                    <span
                                        className={
                                            emailVerified
                                                ? "font-medium text-foreground"
                                                : "font-medium text-amber-900"
                                        }
                                    >
                                        {emailVerified ? "Verified" : "Unverified"}
                                    </span>
                                </p>

                                <p className="text-[0.7rem] text-muted-foreground">
                                    Changing your email will require verification to complete the
                                    change.
                                </p>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* ACCOUNT DETAILS */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Account details
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                {isStudentRole
                                    ? "Students can update name, email, gender, student ID, year level, program and course."
                                    : "You can update your name, email, and gender."}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <form className="space-y-4" onSubmit={handleSaveProfile}>
                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="profile-name">
                                        Name
                                    </Label>
                                    <Input
                                        id="profile-name"
                                        value={profileForm.name}
                                        onChange={(e) =>
                                            setProfileForm((p) => ({
                                                ...p,
                                                name: e.target.value,
                                            }))
                                        }
                                        className="h-9 text-sm"
                                        autoComplete="name"
                                        disabled={isSavingProfile}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="profile-email">
                                        Email
                                    </Label>
                                    <Input
                                        id="profile-email"
                                        type="email"
                                        value={profileForm.email}
                                        onChange={(e) =>
                                            setProfileForm((p) => ({
                                                ...p,
                                                email: e.target.value,
                                            }))
                                        }
                                        className="h-9 text-sm"
                                        autoComplete="email"
                                        disabled={isSavingProfile}
                                    />
                                    <p className="text-[0.7rem] text-muted-foreground">
                                        If you change your email, it becomes{" "}
                                        <span className="font-medium">unverified</span> until you
                                        verify it.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="profile-gender">
                                        Gender
                                    </Label>
                                    <Select
                                        value={profileForm.gender ? profileForm.gender : "none"}
                                        onValueChange={(v) =>
                                            setProfileForm((p) => ({
                                                ...p,
                                                gender: v === "none" ? "" : v,
                                            }))
                                        }
                                        disabled={isSavingProfile}
                                    >
                                        <SelectTrigger
                                            id="profile-gender"
                                            className="h-9 w-full text-sm focus:ring-2 focus:ring-amber-300"
                                        >
                                            <SelectValue placeholder="—" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">—</SelectItem>

                                            {genderNotInList ? (
                                                <SelectItem value={profileForm.gender}>
                                                    {profileForm.gender}
                                                </SelectItem>
                                            ) : null}

                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                            <SelectItem value="nonbinary">Non-binary</SelectItem>
                                            <SelectItem value="prefer-not-to-say">
                                                Prefer not to say
                                            </SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {isStudentRole ? (
                                    <>
                                        <Separator className="my-2" />

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs" htmlFor="profile-student-id">
                                                    Student ID
                                                </Label>
                                                <Input
                                                    id="profile-student-id"
                                                    value={profileForm.student_id}
                                                    onChange={(e) =>
                                                        setProfileForm((p) => ({
                                                            ...p,
                                                            student_id: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 text-sm"
                                                    disabled={isSavingProfile}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs" htmlFor="profile-year-level">
                                                    Year level
                                                </Label>
                                                <Input
                                                    id="profile-year-level"
                                                    value={profileForm.year_level}
                                                    onChange={(e) =>
                                                        setProfileForm((p) => ({
                                                            ...p,
                                                            year_level: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 text-sm"
                                                    disabled={isSavingProfile}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs" htmlFor="profile-program">
                                                    Program
                                                </Label>
                                                <Input
                                                    id="profile-program"
                                                    value={profileForm.program}
                                                    onChange={(e) =>
                                                        setProfileForm((p) => ({
                                                            ...p,
                                                            program: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 text-sm"
                                                    disabled={isSavingProfile}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs" htmlFor="profile-course">
                                                    Course
                                                </Label>
                                                <Input
                                                    id="profile-course"
                                                    value={profileForm.course}
                                                    onChange={(e) =>
                                                        setProfileForm((p) => ({
                                                            ...p,
                                                            course: e.target.value,
                                                        }))
                                                    }
                                                    className="h-9 text-sm"
                                                    disabled={isSavingProfile}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : null}

                                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="submit"
                                        className="w-full gap-2 sm:w-auto"
                                        disabled={!profileDirty || isSavingProfile}
                                    >
                                        {isSavingProfile ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4" />
                                                Save changes
                                            </>
                                        )}
                                    </Button>

                                    <p className="text-[0.7rem] text-muted-foreground">
                                        {profileDirty
                                            ? "You have unsaved changes."
                                            : "No changes to save."}
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* AVATAR */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Profile picture
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Upload a clear photo of yourself to help counselors recognize your
                                account.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                                <Avatar className="h-16 w-16 border border-amber-100 bg-amber-50">
                                    {displayAvatarUrl ? (
                                        <AvatarImage
                                            src={displayAvatarUrl}
                                            alt={user?.name ?? "Profile picture"}
                                            className="object-cover"
                                        />
                                    ) : (
                                        <AvatarFallback className="bg-amber-100 text-sm font-semibold text-amber-900">
                                            {initials}
                                        </AvatarFallback>
                                    )}
                                </Avatar>

                                <div className="flex-1 space-y-2 text-center sm:text-left">
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <p>Supported formats: JPG, PNG.</p>
                                        <p>Maximum size: {MAX_AVATAR_SIZE_MB} MB.</p>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                            id="avatar"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarFileChange}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="w-full gap-1 sm:w-auto"
                                    onClick={handleUploadAvatar}
                                    disabled={!avatarFile || isUploadingAvatar}
                                >
                                    {isUploadingAvatar ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Uploading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="h-3 w-3" />
                                            <span>Upload avatar</span>
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="w-full gap-1 sm:w-auto"
                                    onClick={handleClearAvatar}
                                    disabled={!avatarFile && !avatarPreviewUrl}
                                >
                                    <ImageOff className="h-3 w-3" />
                                    <span>Clear selection</span>
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>

                    <Separator className="my-2" />

                    {/* CHANGE PASSWORD */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Change password
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Use a strong, unique password to protect your eCounseling account.
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <form className="space-y-4" onSubmit={handleChangePassword} autoComplete="off">
                                <div className="space-y-2">
                                    <Label htmlFor="current_password" className="text-xs font-medium text-amber-900">
                                        Current password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="current_password"
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(event) => setCurrentPassword(event.target.value)}
                                            autoComplete="current-password"
                                            className="h-9 pr-9 text-sm"
                                        />
                                        <button
                                            type="button"
                                            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                            onClick={() => setShowCurrentPassword((prev) => !prev)}
                                        >
                                            {showCurrentPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="new_password" className="text-xs font-medium text-amber-900">
                                            New password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="new_password"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(event) => setNewPassword(event.target.value)}
                                                autoComplete="new-password"
                                                className="h-9 pr-9 text-sm"
                                            />
                                            <button
                                                type="button"
                                                aria-label={showNewPassword ? "Hide password" : "Show password"}
                                                className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowNewPassword((prev) => !prev)}
                                            >
                                                {showNewPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            At least 8 characters.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirm_password" className="text-xs font-medium text-amber-900">
                                            Confirm new password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirm_password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                autoComplete="new-password"
                                                className="h-9 pr-9 text-sm"
                                            />
                                            <button
                                                type="button"
                                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                                className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={isChangingPassword}
                                    >
                                        {isChangingPassword ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Changing password...
                                            </>
                                        ) : (
                                            "Change password"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentSettings;
