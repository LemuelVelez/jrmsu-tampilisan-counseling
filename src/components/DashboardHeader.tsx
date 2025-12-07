/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/DashboardHeader.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

interface DashboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
}

function getDashboardTitleForPath(pathname: string): string {
    if (pathname.startsWith("/dashboard/admin")) {
        return "Admin Dashboard";
    }

    if (pathname.startsWith("/dashboard/counselor")) {
        return "Counselor Dashboard";
    }

    if (pathname.startsWith("/dashboard/student")) {
        return "Student Dashboard";
    }

    return "Dashboard";
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title = "Dashboard",
    description,
    actions,
    className,
    ...props
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { session, signOut } = useSession();
    const user = session?.user;

    // If a custom title is provided, use it.
    // Otherwise, derive the title based on the current dashboard path (role).
    const resolvedTitle =
        title === "Dashboard" ? getDashboardTitleForPath(location.pathname) : title;

    const name = (user?.name || user?.email || "Student").toString();
    const email = user?.email?.toString() ?? "";
    const role = user?.role != null ? String(user.role) : "student";

    const initials = React.useMemo(() => {
        const parts = name.trim().split(/\s+/);
        if (!parts.length) return "ST";
        const first = parts[0]?.[0] ?? "";
        const second = parts[1]?.[0] ?? "";
        return (first + second || first).toUpperCase();
    }, [name]);

    // Read avatar URL from user object if backend provides it
    const avatarUrl =
        user &&
            (user as any).avatar_url &&
            typeof (user as any).avatar_url === "string"
            ? ((user as any).avatar_url as string)
            : null;

    const handleSignOut = React.useCallback(async () => {
        try {
            if (!signOut) {
                throw new Error("Sign out is not available.");
            }

            await signOut();
            toast.success("Signed out successfully.");

            // Redirect to login page after successful sign out
            navigate("/auth", { replace: true });
        } catch (error) {
            console.error("[dashboard-header] Sign out failed", error);
            toast.error("Sign out failed. Please try again.");
        }
    }, [signOut, navigate]);

    const handleOpenSettings = React.useCallback(() => {
        if (role.toLowerCase() === "student") {
            navigate("/dashboard/student/settings");
        } else {
            navigate("/dashboard/settings");
        }
    }, [navigate, role]);

    const isTitleLong = resolvedTitle.length > 24;
    const isDescriptionLong = (description?.length ?? 0) > 60;

    return (
        <AlertDialog>
            <header
                className={cn(
                    // Make header sticky at the top
                    "sticky top-0 z-40",
                    // Prevent horizontal overflow on mobile, keep visible on desktop
                    "overflow-x-hidden md:overflow-visible",
                    // Mobile: vertical, tighter padding
                    // Desktop (md+): row, fixed height, same gaps & padding
                    "flex flex-col gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur md:h-16 md:flex-row md:items-center md:gap-3 md:px-6 md:py-0",
                    className,
                )}
                {...props}
            >
                {/* Title + description block (mobile + desktop left side) */}
                <div className="flex items-start gap-2 md:flex-1 md:items-center md:gap-3">
                    <SidebarTrigger className="-ml-1" />

                    {/* Wrap text + mobile avatar in a single row so avatar is on the right */}
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                        {/* Text (title + description) */}
                        <div className="flex min-w-0 flex-col gap-0.5">
                            {/* Title with optional dropdown when long */}
                            {isTitleLong ? (
                                <div className="flex max-w-full items-center gap-1 md:max-w-none">
                                    <h1 className="w-0 flex-1 truncate text-xs font-semibold leading-tight md:w-auto md:text-lg">
                                        {resolvedTitle}
                                    </h1>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="shrink-0 rounded-full border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:bg-muted"
                                            >
                                                Full
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="max-w-sm"
                                        >
                                            <DropdownMenuLabel className="whitespace-normal text-xs font-medium">
                                                {resolvedTitle}
                                            </DropdownMenuLabel>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ) : (
                                <h1 className="max-w-full truncate text-xs font-semibold leading-tight md:max-w-none md:text-lg">
                                    {resolvedTitle}
                                </h1>
                            )}

                            {/* Description with optional dropdown when long */}
                            {description && (
                                isDescriptionLong ? (
                                    <div className="flex max-w-full items-center gap-1 md:max-w-lg">
                                        {/* 
                                          Mobile: hide description text (only show the "More" trigger).
                                          Desktop (md+): show the truncated text + "More" trigger (unchanged behavior).
                                        */}
                                        <p className="hidden truncate text-[0.65rem] text-muted-foreground md:block md:flex-1 md:text-sm">
                                            {description}
                                        </p>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="shrink-0 rounded-full border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:bg-muted"
                                                >
                                                    More
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="start"
                                                // Mobile: narrower fixed width; Desktop: original max-w-sm behaviour
                                                className="w-40 md:w-auto md:max-w-sm"
                                            >
                                                <DropdownMenuLabel className="whitespace-normal text-xs font-normal">
                                                    {description}
                                                </DropdownMenuLabel>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ) : (
                                    <p className="max-w-full truncate text-[0.65rem] text-muted-foreground md:max-w-xl md:text-sm">
                                        {description}
                                    </p>
                                )
                            )}
                        </div>

                        {/* MOBILE avatar dropdown on the right (hidden on desktop) */}
                        <div className="shrink-0 md:hidden">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="group flex items-center gap-1 rounded-full border bg-background p-1.5 text-[0.7rem] shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <Avatar className="h-7 w-7 shrink-0">
                                            {avatarUrl ? (
                                                <AvatarImage
                                                    src={avatarUrl}
                                                    alt={name}
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <AvatarFallback className="text-[0.65rem]">
                                                    {initials}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>
                                        {/* Animated Chevron only on mobile avatar trigger */}
                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                    </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                    side="bottom"
                                    align="end"
                                    className="min-w-52
                                               data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
                                               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
                                               data-[side=top]:slide-in-from-bottom-2"
                                >
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-xs font-medium leading-tight">
                                                {name}
                                            </p>
                                            {email && (
                                                <p className="text-[0.7rem] text-muted-foreground">
                                                    {email}
                                                </p>
                                            )}
                                            <p className="text-[0.65rem] capitalize text-muted-foreground/80">
                                                Role: {role}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                        className="text-xs"
                                        onSelect={handleOpenSettings}
                                    >
                                        Settings
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem
                                            className="text-xs text-destructive focus:text-destructive"
                                            onSelect={(event) => event.preventDefault()}
                                        >
                                            <LogOut className="mr-2 h-3.5 w-3.5" />
                                            Sign out
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* MOBILE: actions row only (avatar handled above) */}
                {actions && (
                    <div className="mt-1 flex w-full items-center justify-start gap-1 md:hidden">
                        {actions}
                    </div>
                )}

                {/* DESKTOP: Actions + avatar (unchanged behavior) */}
                <div className="hidden w-full items-center justify-between gap-2 md:ml-auto md:flex md:w-auto md:justify-end">
                    {actions && (
                        <div className="flex max-w-[60%] flex-wrap items-center gap-2 md:max-w-none md:justify-end">
                            {actions}
                        </div>
                    )}

                    {/* User avatar + dropdown - desktop */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex max-w-[55%] items-center gap-2 overflow-hidden rounded-full border bg-background px-2 py-1 text-[0.7rem] shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:max-w-none md:text-xs"
                            >
                                <Avatar className="h-7 w-7 shrink-0">
                                    {avatarUrl ? (
                                        <AvatarImage
                                            src={avatarUrl}
                                            alt={name}
                                            className="object-cover"
                                        />
                                    ) : (
                                        <AvatarFallback className="text-[0.65rem]">
                                            {initials}
                                        </AvatarFallback>
                                    )}
                                </Avatar>

                                <div className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
                                    <span className="max-w-22 truncate text-[0.7rem] font-medium md:max-w-36 md:text-xs">
                                        {name}
                                    </span>
                                    {email && (
                                        <span className="max-w-22 truncate text-[0.65rem] text-muted-foreground md:max-w-36 md:text-[0.7rem]">
                                            {email}
                                        </span>
                                    )}
                                </div>

                                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            side="bottom"
                            align="end"
                            className="min-w-52
                                       data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
                                       data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
                                       data-[side=top]:slide-in-from-bottom-2"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-xs font-medium leading-tight">
                                        {name}
                                    </p>
                                    {email && (
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            {email}
                                        </p>
                                    )}
                                    <p className="text-[0.65rem] capitalize text-muted-foreground/80">
                                        Role: {role}
                                    </p>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                className="text-xs"
                                onSelect={handleOpenSettings}
                            >
                                Settings
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                    className="text-xs text-destructive focus:text-destructive"
                                    onSelect={(event) => event.preventDefault()}
                                >
                                    <LogOut className="mr-2 h-3.5 w-3.5" />
                                    Sign out
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Sign out confirmation dialog */}
            <AlertDialogContent className="sm:max-w-[400px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Sign out</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to sign out of your account? You can
                        always sign back in later.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="text-xs">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleSignOut}
                        className="text-xs bg-destructive text-white hover:bg-destructive/90"
                    >
                        Sign out
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DashboardHeader;
