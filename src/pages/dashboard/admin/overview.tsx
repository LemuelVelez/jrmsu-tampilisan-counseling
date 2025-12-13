import React from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

import {
    getCurrentSession,
    subscribeToSession,
    type AuthSession,
} from "@/lib/authentication";
import { normalizeRole, resolveDashboardPathForRole } from "@/lib/role";

/**
 * Subscribe to global auth session (same approach as other pages).
 */
function useAuthSession(): AuthSession {
    const [session, setSession] = React.useState<AuthSession>(() =>
        getCurrentSession(),
    );

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((next) => setSession(next));
        return unsubscribe;
    }, []);

    return session;
}

type OverviewItem = {
    key: string;
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    comingSoon?: boolean;
};

const ADMIN_OVERVIEW_ITEMS: OverviewItem[] = [
    {
        key: "users",
        title: "Users",
        description:
            "View all users, check avatars, update user roles, and add new users.",
        // File: src/pages/dashboard/admin/user.tsx  -> route is typically /dashboard/admin/user
        href: "/dashboard/admin/user",
        icon: Users,
    },

    // Add future admin pages here (example):
    // {
    //   key: "roles",
    //   title: "Roles",
    //   description: "Manage roles and permissions.",
    //   href: "/dashboard/admin/roles",
    //   icon: Shield,
    //   comingSoon: true,
    // },
];

const AdminOverviewInner: React.FC = () => {
    return (
        <DashboardLayout
            title="Overview"
            description="Admin dashboard shortcuts. More admin pages will be added here later."
        >
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    {ADMIN_OVERVIEW_ITEMS.map((item) => {
                        const Icon = item.icon;

                        return (
                            <Card
                                key={item.key}
                                className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur"
                            >
                                <CardHeader className="space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                                <Icon className="h-4 w-4" />
                                                {item.title}
                                            </CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                {item.description}
                                            </CardDescription>
                                        </div>

                                        {item.comingSoon ? (
                                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.7rem] font-medium text-amber-900">
                                                Coming soon
                                            </span>
                                        ) : null}
                                    </div>
                                </CardHeader>

                                <CardContent className="flex items-center justify-end">
                                    {item.comingSoon ? (
                                        <Button type="button" variant="outline" size="sm" disabled>
                                            Open
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button asChild type="button" size="sm" className="gap-2">
                                            <Link to={item.href}>
                                                Open
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-amber-900">
                            Add future pages here
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            When you add new admin pages (e.g., Roles, Reports, Settings), just
                            add another item to <span className="font-medium">ADMIN_OVERVIEW_ITEMS</span>{" "}
                            in this file so it shows up on this overview.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        </DashboardLayout>
    );
};

const AdminOverviewPage: React.FC = () => {
    const session = useAuthSession();
    const me = session.user;
    const myRole = normalizeRole(me?.role ?? "");

    if (!me) return <Navigate to="/auth" replace />;

    if (!myRole.includes("admin")) {
        const dashboardPath = resolveDashboardPathForRole(me.role ?? "");
        return <Navigate to={dashboardPath} replace />;
    }

    return <AdminOverviewInner />;
};

export default AdminOverviewPage;
