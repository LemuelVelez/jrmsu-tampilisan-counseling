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
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    getCurrentSession,
    subscribeToSession,
    uploadCurrentUserAvatar,
    type AuthSession,
} from "@/lib/authentication";
import {
    Loader2,
    UploadCloud,
    ImageOff,
    Eye,
    EyeOff,
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

const StudentSettings: React.FC = () => {
    // Keep session reactive so avatar_url changes are reflected immediately.
    const [session, setSession] = React.useState<AuthSession>(getCurrentSession());
    const user = session.user;

    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [isChangingPassword, setIsChangingPassword] = React.useState(false);

    const [showCurrentPassword, setShowCurrentPassword] =
        React.useState(false);
    const [showNewPassword, setShowNewPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] =
        React.useState(false);

    const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(
        null,
    );
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

    // Subscribe to global session updates (e.g. after avatar upload, meApi, etc.)
    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });
        return unsubscribe;
    }, []);

    // If backend returns an avatar URL, read it from the user object.
    const existingAvatarUrl =
        (user as any)?.avatar_url && typeof (user as any).avatar_url === "string"
            ? ((user as any).avatar_url as string)
            : null;

    const displayAvatarUrl = avatarPreviewUrl || existingAvatarUrl || null;

    React.useEffect(() => {
        return () => {
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
        };
    }, [avatarPreviewUrl]);

    const handleAvatarFileChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file (JPG, PNG, etc.).");
            event.target.value = "";
            return;
        }

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            toast.error(
                `Image is too large. Maximum size is ${MAX_AVATAR_SIZE_MB} MB.`,
            );
            event.target.value = "";
            return;
        }

        if (avatarPreviewUrl) {
            URL.revokeObjectURL(avatarPreviewUrl);
        }

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

            // Clean up local preview; avatar will now come from user.avatar_url
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
            }
            setAvatarPreviewUrl(null);
            setAvatarFile(null);

            toast.success(
                result.raw.message ?? "Your profile picture has been updated.",
            );
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
        if (avatarPreviewUrl) {
            URL.revokeObjectURL(avatarPreviewUrl);
        }
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
    };

    const handleChangePassword = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
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
            /**
             * NOTE:
             * This is still frontend-only.
             *
             * Later you can:
             *   - Add an endpoint (e.g. POST /auth/change-password)
             *   - Call it from here and update the session if needed.
             */

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

    return (
        <DashboardLayout
            title="Settings"
            description="Manage your account password and profile picture."
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
                                    {user?.email}
                                </CardDescription>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    These settings apply only to your student eCounseling
                                    account.
                                </p>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* AVATAR / DISPLAY PICTURE */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Profile picture
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Upload a clear photo of yourself to help counselors recognize
                                your account.
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
                                Use a strong, unique password to protect your eCounseling
                                account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                className="space-y-4"
                                onSubmit={handleChangePassword}
                                autoComplete="off"
                            >
                                {/* Current password */}
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="current_password"
                                        className="text-xs font-medium text-amber-900"
                                    >
                                        Current password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="current_password"
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(event) =>
                                                setCurrentPassword(event.target.value)
                                            }
                                            autoComplete="current-password"
                                            className="h-9 pr-9 text-sm"
                                        />
                                        <button
                                            type="button"
                                            aria-label={
                                                showCurrentPassword ? "Hide password" : "Show password"
                                            }
                                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                            onClick={() =>
                                                setShowCurrentPassword((prev) => !prev)
                                            }
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
                                    {/* New password */}
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="new_password"
                                            className="text-xs font-medium text-amber-900"
                                        >
                                            New password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="new_password"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(event) =>
                                                    setNewPassword(event.target.value)
                                                }
                                                autoComplete="new-password"
                                                className="h-9 pr-9 text-sm"
                                            />
                                            <button
                                                type="button"
                                                aria-label={
                                                    showNewPassword ? "Hide password" : "Show password"
                                                }
                                                className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                                onClick={() =>
                                                    setShowNewPassword((prev) => !prev)
                                                }
                                            >
                                                {showNewPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            At least 8 characters. Use a mix of letters, numbers,
                                            and symbols if possible.
                                        </p>
                                    </div>

                                    {/* Confirm new password */}
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="confirm_password"
                                            className="text-xs font-medium text-amber-900"
                                        >
                                            Confirm new password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirm_password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(event) =>
                                                    setConfirmPassword(event.target.value)
                                                }
                                                autoComplete="new-password"
                                                className="h-9 pr-9 text-sm"
                                            />
                                            <button
                                                type="button"
                                                aria-label={
                                                    showConfirmPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                                className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                                onClick={() =>
                                                    setShowConfirmPassword((prev) => !prev)
                                                }
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
