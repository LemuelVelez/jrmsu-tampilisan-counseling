/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { SidebarMenuButton } from "@/components/ui/sidebar";
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
import { useSession } from "@/hooks/use-session";
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
import { toast } from "sonner";

export const NavUser: React.FC = () => {
    const { session, signOut } = useSession();
    const navigate = useNavigate();
    const user = session?.user;

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
            console.error("[nav-user] Sign out failed", error);
            toast.error("Sign out failed. Please try again.");
        }
    }, [signOut, navigate]);

    const handleOpenSettings = React.useCallback(() => {
        // Route students to their specific settings page.
        // You can adjust the fallback path for other roles as needed.
        if (role.toLowerCase() === "student") {
            navigate("/dashboard/student/settings");
        } else {
            navigate("/dashboard/settings");
        }
    }, [navigate, role]);

    return (
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        size="lg"
                        className="group w-full justify-start gap-3 data-[state=open]:bg-sidebar-accent/80"
                    >
                        <Avatar className="h-7 w-7">
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

                        <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                            <span className="truncate text-xs font-medium">
                                {name}
                            </span>
                            {email && (
                                <span className="truncate text-[0.7rem] text-sidebar-foreground/70">
                                    {email}
                                </span>
                            )}
                        </div>

                        <span className="rounded-full bg-sidebar-accent/60 px-1.5 py-0.5 text-[0.65rem] font-medium capitalize text-sidebar-accent-foreground">
                            {role}
                        </span>

                        <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60 transition-transform duration-150 group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-48
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
