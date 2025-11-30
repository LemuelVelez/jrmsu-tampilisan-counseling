import React from "react";
import { ChevronDown, LogOut } from "lucide-react";

import {
    SidebarMenuButton,
} from "@/components/ui/sidebar";
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
} from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";

export const NavUser: React.FC = () => {
    const { session, signOut } = useSession();
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

    const handleSignOut = React.useCallback(async () => {
        try {
            await signOut?.();
        } catch (error) {
            console.error("[nav-user] Sign out failed", error);
        }
    }, [signOut]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                    size="lg"
                    className="w-full justify-start gap-3 data-[state=open]:bg-sidebar-accent/80"
                >
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[0.65rem]">
                            {initials}
                        </AvatarFallback>
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

                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-48"
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
                <DropdownMenuItem className="text-xs">
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-xs text-destructive focus:text-destructive"
                >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
