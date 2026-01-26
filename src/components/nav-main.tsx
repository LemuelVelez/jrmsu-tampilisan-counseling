/* eslint-disable @typescript-eslint/no-explicit-any */
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
    Share2,
    FileText,
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

type BadgeKey = "messages" | "appointments" | "referrals";

type NavItem = {
    title: string;
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    exact?: boolean;
    badgeKey?: BadgeKey;
};

type RoleKey = "student" | "counselor" | "admin" | "referralUser";

type NotificationCounts = {
    messages: number;
    appointments: number;
    referrals: number;
};

function normalizePath(path: string): string {
    const trimmed = path.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
}

function formatBadgeValue(n: number) {
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n > 99) return "99+";
    return String(n);
}

function safeNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function mapCountsFromApi(payload: any): NotificationCounts {
    return {
        messages:
            safeNumber(payload?.messages) ||
            safeNumber(payload?.unread_messages) ||
            safeNumber(payload?.unreadMessages) ||
            safeNumber(payload?.unread_messages_count) ||
            0,
        appointments:
            safeNumber(payload?.appointments) ||
            safeNumber(payload?.appointment_requests) ||
            safeNumber(payload?.pending_appointments) ||
            safeNumber(payload?.pending_requests) ||
            safeNumber(payload?.pending_appointment_requests_count) ||
            0,
        referrals:
            safeNumber(payload?.referrals) ||
            safeNumber(payload?.new_referrals) ||
            safeNumber(payload?.referrals_count) ||
            safeNumber(payload?.new_referrals_count) ||
            0,
    };
}

/**
 * STUDENT NAV ITEMS
 */
const studentNavItems: NavItem[] = [
    {
        title: "Overview",
        to: "/dashboard/student",
        icon: LayoutDashboard,
        exact: true,
    },
    {
        title: "Intake",
        to: "/dashboard/student/intake",
        icon: ClipboardList,
    },
    {
        title: "Messages",
        to: "/dashboard/student/messages",
        icon: MessageCircle,
        badgeKey: "messages",
    },
    {
        title: "Evaluation",
        to: "/dashboard/student/evaluation",
        icon: CalendarClock,
    },
    {
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
        exact: true,
    },
    {
        title: "Intake",
        to: "/dashboard/counselor/intake",
        icon: ClipboardList,
    },
    {
        title: "Appointments",
        to: "/dashboard/counselor/appointments",
        icon: CalendarClock,
        badgeKey: "appointments",
    },
    {
        title: "Messages",
        to: "/dashboard/counselor/messages",
        icon: MessageCircle,
        badgeKey: "messages",
    },
    {
        title: "Referrals",
        to: "/dashboard/counselor/referrals",
        icon: Share2,
        badgeKey: "referrals",
    },
    {
        title: "Assessment Reports",
        to: "/dashboard/counselor/assessment-report",
        icon: FileText,
    },
    {
        title: "Analytics",
        to: "/dashboard/counselor/analytics",
        icon: BarChart3,
    },
    {
        title: "Students & Guests",
        to: "/dashboard/counselor/users",
        icon: GraduationCap,
    },
    {
        title: "Settings",
        to: "/dashboard/counselor/settings",
        icon: Settings,
    },
];

/**
 * REFERRAL USER NAV ITEMS (Dean / Registrar / Program Chair)
 */
const referralUserNavItems: NavItem[] = [
    {
        title: "Referrals",
        to: "/dashboard/referral-user/referrals",
        icon: Share2,
        badgeKey: "referrals",
    },
    {
        title: "Messages",
        to: "/dashboard/referral-user/messages",
        icon: MessageCircle,
        badgeKey: "messages",
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
        exact: true,
    },
    {
        title: "Users",
        to: "/dashboard/admin/users",
        icon: Users,
    },
    {
        title: "Settings",
        to: "/dashboard/admin/settings",
        icon: Settings,
    },
];

const navConfig: Record<RoleKey, { label: string; items: NavItem[] }> = {
    student: {
        label: "Student",
        items: studentNavItems,
    },
    counselor: {
        label: "Counselor",
        items: counselorNavItems,
    },
    referralUser: {
        label: "Referral User",
        items: referralUserNavItems,
    },
    admin: {
        label: "Admin",
        items: adminNavItems,
    },
};

function useAuthSession(): AuthSession {
    const [session, setSession] = React.useState<AuthSession>(() =>
        getCurrentSession()
    );

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });

        return unsubscribe;
    }, []);

    return session;
}

async function fetchNotificationCounts(authToken?: string | null): Promise<NotificationCounts> {
    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL ?? "";
    const url = `${apiBase}/api/notification-counts`;

    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch notification counts (${res.status})`);
    }

    const json = await res.json();
    return mapCountsFromApi(json);
}

export const NavMain: React.FC = () => {
    const location = useLocation();
    const session = useAuthSession();
    const { user } = session;

    const normalizedRole = normalizeRole(user?.role ?? "");
    let roleKey: RoleKey = "student";

    if (normalizedRole.includes("admin")) {
        roleKey = "admin";
    } else if (normalizedRole.includes("counselor") || normalizedRole.includes("counsellor")) {
        roleKey = "counselor";
    } else if (
        normalizedRole.includes("dean") ||
        normalizedRole.includes("registrar") ||
        normalizedRole.includes("program chair") ||
        normalizedRole.includes("program_chair") ||
        normalizedRole.includes("chair")
    ) {
        roleKey = "referralUser";
    }

    const { label, items } = navConfig[roleKey];
    const currentPath = normalizePath(location.pathname);

    const [counts, setCounts] = React.useState<NotificationCounts>({
        messages: 0,
        appointments: 0,
        referrals: 0,
    });

    const authToken =
        (session as any)?.token ??
        (session as any)?.access_token ??
        (session as any)?.accessToken ??
        null;

    const shouldFetchCounts =
        !!user && (roleKey === "student" || roleKey === "counselor" || roleKey === "referralUser");

    const refreshCounts = React.useCallback(async () => {
        if (!shouldFetchCounts) return;

        try {
            const next = await fetchNotificationCounts(authToken);
            setCounts(next);
        } catch {
            // silent fail: keep current badge state
        }
    }, [authToken, shouldFetchCounts]);

    React.useEffect(() => {
        refreshCounts();
    }, [refreshCounts]);

    React.useEffect(() => {
        if (!shouldFetchCounts) return;

        const interval = window.setInterval(() => {
            refreshCounts();
        }, 30000);

        const onFocus = () => refreshCounts();
        window.addEventListener("focus", onFocus);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, [refreshCounts, shouldFetchCounts]);

    const getBadgeForItem = (badgeKey?: BadgeKey): string => {
        if (!badgeKey) return "";
        if (badgeKey === "messages") return formatBadgeValue(counts.messages);
        if (badgeKey === "appointments") return formatBadgeValue(counts.appointments);
        if (badgeKey === "referrals") return formatBadgeValue(counts.referrals);
        return "";
    };

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
                            : currentPath === itemPath || currentPath.startsWith(itemPath + "/");

                        const badgeText = getBadgeForItem(item.badgeKey);

                        return (
                            <SidebarMenuItem key={item.to}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    className={cn(
                                        "transition-colors",
                                        isActive
                                            ? "border-l-2 border-sidebar-primary bg-sidebar-primary/10 text-sidebar-primary shadow-xs"
                                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    )}
                                >
                                    <Link to={item.to} className="flex w-full items-center gap-2">
                                        <Icon />
                                        <span className="flex-1">{item.title}</span>

                                        {badgeText ? (
                                            <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sidebar-primary/15 px-2 py-0.5 text-[0.7rem] font-semibold text-sidebar-primary">
                                                {badgeText}
                                            </span>
                                        ) : null}
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
