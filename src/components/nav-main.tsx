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
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { normalizeRole } from "@/lib/role";
import {
    getCurrentSession,
    subscribeToSession,
    type AuthSession,
} from "@/lib/authentication";
import { AUTH_API_BASE_URL } from "@/api/auth/route";

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
    messages: number; // ✅ UNREAD messages only
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
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n;
}

/**
 * ✅ IMPORTANT FIX (Mapping):
 * Use ONLY the unread_* counters from the backend.
 * Do NOT fall back to a generic "messages" count because some backends return total messages,
 * which causes the badge to stay nonzero.
 */
function mapCountsFromApi(payload: any): NotificationCounts {
    const src =
        payload?.counts && typeof payload.counts === "object" ? payload.counts : payload ?? {};

    const unreadMessages =
        safeNumber(
            src?.unread_messages ??
            src?.unreadMessages ??
            src?.unread_messages_count ??
            src?.unread_count ??
            src?.unread ??
            0,
        );

    const pendingAppointments =
        safeNumber(
            src?.pending_appointments ??
            src?.pendingAppointments ??
            src?.pending_requests ??
            src?.pending_appointment_requests_count ??
            0,
        );

    const newReferrals =
        safeNumber(
            src?.new_referrals ??
            src?.newReferrals ??
            src?.new_referrals_count ??
            src?.referrals_unread ??
            0,
        );

    return {
        messages: unreadMessages,
        appointments: pendingAppointments,
        referrals: newReferrals,
    };
}

/**
 * STUDENT NAV ITEMS
 */
const studentNavItems: NavItem[] = [
    { title: "Overview", to: "/dashboard/student", icon: LayoutDashboard, exact: true },
    { title: "Intake", to: "/dashboard/student/intake", icon: ClipboardList },
    { title: "Messages", to: "/dashboard/student/messages", icon: MessageCircle, badgeKey: "messages" },
    { title: "Evaluation", to: "/dashboard/student/evaluation", icon: CalendarClock },
    { title: "Settings", to: "/dashboard/student/settings", icon: Settings },
];

/**
 * COUNSELOR NAV ITEMS
 */
const counselorNavItems: NavItem[] = [
    { title: "Overview", to: "/dashboard/counselor", icon: LayoutDashboard, exact: true },
    { title: "Intake", to: "/dashboard/counselor/intake", icon: ClipboardList },
    { title: "Appointments", to: "/dashboard/counselor/appointments", icon: CalendarClock, badgeKey: "appointments" },
    { title: "Messages", to: "/dashboard/counselor/messages", icon: MessageCircle, badgeKey: "messages" },
    { title: "Referrals", to: "/dashboard/counselor/referrals", icon: Share2, badgeKey: "referrals" },
    { title: "Case Load", to: "/dashboard/counselor/case-load", icon: Users },
    { title: "Hardcopy Scores", to: "/dashboard/counselor/assessment-score-input", icon: FileText },
    { title: "Assessment Reports", to: "/dashboard/counselor/assessment-report", icon: FileText },
    { title: "Analytics", to: "/dashboard/counselor/analytics", icon: BarChart3 },
    { title: "Students & Guests", to: "/dashboard/counselor/users", icon: GraduationCap },
    { title: "Settings", to: "/dashboard/counselor/settings", icon: Settings },
];

/**
 * REFERRAL USER NAV ITEMS
 */
const referralUserNavItems: NavItem[] = [
    { title: "Overview", to: "/dashboard/referral-user/overview", icon: LayoutDashboard, exact: true },
    { title: "Referrals", to: "/dashboard/referral-user/referrals", icon: Share2, badgeKey: "referrals" },
    { title: "Messages", to: "/dashboard/referral-user/messages", icon: MessageCircle, badgeKey: "messages" },
    { title: "Settings", to: "/dashboard/referral-user/settings", icon: Settings },
];

/**
 * ADMIN NAV ITEMS
 */
const adminNavItems: NavItem[] = [
    { title: "Overview", to: "/dashboard/admin", icon: LayoutDashboard, exact: true },
    { title: "Users", to: "/dashboard/admin/users", icon: Users },
    { title: "Messages", to: "/dashboard/admin/messages", icon: MessageCircle, badgeKey: "messages" },
    { title: "Analytics", to: "/dashboard/admin/analytics", icon: BarChart3 },
    { title: "Settings", to: "/dashboard/admin/settings", icon: Settings },
];

const navConfig: Record<RoleKey, { label: string; items: NavItem[] }> = {
    student: { label: "Student", items: studentNavItems },
    counselor: { label: "Counselor", items: counselorNavItems },
    referralUser: { label: "Referral User", items: referralUserNavItems },
    admin: { label: "Admin", items: adminNavItems },
};

function useAuthSession(): AuthSession {
    const [session, setSession] = React.useState<AuthSession>(() => getCurrentSession());

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });
        return unsubscribe;
    }, []);

    return session;
}

function trimSlash(s: string) {
    return s.replace(/\/+$/, "");
}

async function fetchNotificationCountsRaw(authToken?: string | null): Promise<any> {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
    }

    const url = `${trimSlash(AUTH_API_BASE_URL)}/notifications/counts`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(url, { method: "GET", headers, credentials: "include" });

    if (!res.ok) {
        throw new Error(`Failed to fetch notification counts (${res.status})`);
    }

    const json = await res.json();

    if (import.meta.env.DEV) {
        console.debug("[/notifications/counts] raw payload:", json);
    }

    return json;
}

function isReferralUserRole(normalizedRole: string): boolean {
    // ✅ include explicit referral variants AND role-based referral user types
    if (
        normalizedRole.includes("referral") ||
        normalizedRole.includes("referral-user") ||
        normalizedRole.includes("referral_user") ||
        normalizedRole.includes("referraluser")
    ) {
        return true;
    }

    // ✅ your existing mapping (dean/registrar/chair variants)
    return (
        normalizedRole.includes("dean") ||
        normalizedRole.includes("registrar") ||
        normalizedRole.includes("program chair") ||
        normalizedRole.includes("program_chair") ||
        normalizedRole.includes("chair")
    );
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
    } else if (isReferralUserRole(normalizedRole)) {
        roleKey = "referralUser";
    }

    const { label, items } = navConfig[roleKey];
    const currentPath = normalizePath(location.pathname);

    const isMessagesRoute =
        currentPath.includes("/messages") ||
        currentPath.endsWith("/messages") ||
        currentPath.includes("/dashboard/counselor/messages") ||
        currentPath.includes("/dashboard/student/messages") ||
        currentPath.includes("/dashboard/referral-user/messages") ||
        currentPath.includes("/dashboard/admin/messages");

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

    const shouldFetchCounts = !!user;

    const refreshCounts = React.useCallback(async () => {
        if (!shouldFetchCounts) return;

        try {
            const raw = await fetchNotificationCountsRaw(authToken);
            const next = mapCountsFromApi(raw);
            setCounts(next);
        } catch {
            // silent fail: keep current badge state
        }
    }, [authToken, shouldFetchCounts]);

    React.useEffect(() => {
        refreshCounts();
    }, [location.pathname, refreshCounts]);

    React.useEffect(() => {
        if (!shouldFetchCounts) return;

        const fastPoll = isMessagesRoute && counts.messages > 0;
        const intervalMs = fastPoll ? 3000 : 30000;

        const interval = window.setInterval(() => {
            refreshCounts();
        }, intervalMs);

        const onFocus = () => refreshCounts();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") refreshCounts();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [refreshCounts, shouldFetchCounts, isMessagesRoute, counts.messages]);

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
                                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    )}
                                >
                                    <Link to={item.to} className="flex w-full items-center gap-2">
                                        <Icon />
                                        <span className="flex-1">{item.title}</span>

                                        {badgeText ? (
                                            <Badge
                                                variant="secondary"
                                                className="ml-auto min-w-5 justify-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
                                            >
                                                {badgeText}
                                            </Badge>
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
