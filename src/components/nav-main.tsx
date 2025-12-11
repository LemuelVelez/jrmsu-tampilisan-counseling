import React from "react";
import {
    LayoutDashboard,
    CalendarClock,
    ClipboardList,
    MessageCircle,
    Settings,
    Users,
    GraduationCap,
    BarChart3,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { normalizeRole } from "@/lib/role";
import {
    getCurrentSession,
    subscribeToSession,
    type AuthSession,
} from "@/lib/authentication";

type NavItem = {
    title: string;
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    /**
     * If true, the item is only active on an exact path match
     * (ignoring trailing slashes).
     * Useful for "Overview" dashboard roots.
     */
    exact?: boolean;
};

type RoleKey = "student" | "counselor" | "admin";

/**
 * Normalize a path so "/foo" and "/foo/" are treated the same.
 */
function normalizePath(path: string): string {
    const trimmed = path.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
}

/**
 * STUDENT NAV ITEMS
 */
const studentNavItems: NavItem[] = [
    {
        title: "Overview",
        to: "/dashboard/student",
        icon: LayoutDashboard,
        exact: true, // 👈 only active on /dashboard/student
    },
    {
        // Counseling Request / Intake
        title: "Intake",
        to: "/dashboard/student/intake",
        icon: ClipboardList,
    },
    {
        // Messages between student & Guidance Office
        title: "Messages",
        to: "/dashboard/student/messages",
        icon: MessageCircle,
    },
    {
        // Evaluation (Appointments & Assessment history)
        title: "Evaluation",
        to: "/dashboard/student/evaluation",
        icon: CalendarClock,
    },
    {
        // Account settings: password + avatar
        title: "Settings",
        to: "/dashboard/student/settings",
        icon: Settings,
    },
];

/**
 * COUNSELOR NAV ITEMS
 */
const counselorNavItems: NavItem[] = [
    {
        title: "Overview",
        to: "/dashboard/counselor",
        icon: LayoutDashboard,
        exact: true, // 👈 only active on /dashboard/counselor
    },
    {
        title: "Appointments",
        to: "/dashboard/counselor/appointments",
        icon: CalendarClock,
    },
    {
        title: "Students",
        to: "/dashboard/counselor/students",
        icon: GraduationCap,
    },
    {
        title: "Messages",
        to: "/dashboard/counselor/messages",
        icon: MessageCircle,
    },
    {
        title: "Reports",
        to: "/dashboard/counselor/reports",
        icon: BarChart3,
    },
    {
        title: "Settings",
        to: "/dashboard/counselor/settings",
        icon: Settings,
    },
];

/**
 * ADMIN NAV ITEMS
 */
const adminNavItems: NavItem[] = [
    {
        title: "Overview",
        to: "/dashboard/admin",
        icon: LayoutDashboard,
        exact: true, // 👈 only active on /dashboard/admin
    },
    {
        title: "Users",
        to: "/dashboard/admin/users",
        icon: Users,
    },
    {
        title: "Counselors",
        to: "/dashboard/admin/counselors",
        icon: Users,
    },
    {
        title: "Students",
        to: "/dashboard/admin/students",
        icon: GraduationCap,
    },
    {
        title: "Reports",
        to: "/dashboard/admin/reports",
        icon: BarChart3,
    },
    {
        title: "Settings",
        to: "/dashboard/admin/settings",
        icon: Settings,
    },
];

/**
 * Map roles to a nav label + items
 */
const navConfig: Record<RoleKey, { label: string; items: NavItem[] }> = {
    student: {
        label: "Student",
        items: studentNavItems,
    },
    counselor: {
        label: "Counselor",
        items: counselorNavItems,
    },
    admin: {
        label: "Admin",
        items: adminNavItems,
    },
};

/**
 * Simple hook to subscribe to the global auth session
 * using the helpers from src/lib/authentication.ts
 */
function useAuthSession(): AuthSession {
    const [session, setSession] = React.useState<AuthSession>(() =>
        getCurrentSession(),
    );

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });

        return unsubscribe;
    }, []);

    return session;
}

export const NavMain: React.FC = () => {
    const location = useLocation();
    const { user } = useAuthSession();

    const normalizedRole = normalizeRole(user?.role ?? "");
    let roleKey: RoleKey = "student";

    if (normalizedRole.includes("admin")) {
        roleKey = "admin";
    } else if (
        normalizedRole.includes("counselor") ||
        normalizedRole.includes("counsellor")
    ) {
        roleKey = "counselor";
    }

    const { label, items } = navConfig[roleKey];
    const currentPath = normalizePath(location.pathname);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => {
                        const Icon = item.icon;
                        const itemPath = normalizePath(item.to);

                        const isActive = item.exact
                            ? currentPath === itemPath
                            : currentPath === itemPath ||
                            currentPath.startsWith(itemPath + "/");

                        return (
                            <SidebarMenuItem key={item.to}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    className={cn(
                                        "transition-colors",
                                        isActive
                                            ? "border-l-2 border-sidebar-primary bg-sidebar-primary/10 text-sidebar-primary shadow-xs"
                                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    )}
                                >
                                    <Link to={item.to}>
                                        <Icon />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
};
