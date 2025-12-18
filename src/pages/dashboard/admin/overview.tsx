/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Loader2,
    RefreshCcw,
    Users,
    Shield,
    GraduationCap,
    HeartHandshake,
    UserCog,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { AUTH_API_BASE_URL, type AuthenticatedUserDto } from "@/api/auth/route";
import { normalizeRole } from "@/lib/role";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

type AdminUser = AuthenticatedUserDto & {
    role?: string | null;
    avatar_url?: string | null;
    created_at?: string | null;
};

type RolesResponse =
    | string[]
    | { roles?: string[]; data?: string[];[k: string]: unknown };

type UsersResponse =
    | AdminUser[]
    | { users?: AdminUser[]; data?: AdminUser[];[k: string]: unknown };

const FALLBACK_ROLES = ["admin", "counselor", "student"] as const;
const PIE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#64748b"];
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveApiUrl(path: string): string {
    if (!AUTH_API_BASE_URL) {
        throw new Error("VITE_API_LARAVEL_BASE_URL is not defined. Set it in your .env file.");
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

function extractRoles(payload: RolesResponse): string[] {
    if (Array.isArray(payload)) return payload.filter(Boolean).map(String);
    const obj = payload as any;
    const roles = obj?.roles ?? obj?.data;
    if (Array.isArray(roles)) return roles.filter(Boolean).map(String);
    return [];
}

function extractUsers(payload: UsersResponse): AdminUser[] {
    if (Array.isArray(payload)) return payload as AdminUser[];
    const obj = payload as any;
    const users = obj?.users ?? obj?.data;
    if (Array.isArray(users)) return users as AdminUser[];
    return [];
}

function niceRoleLabel(roleRaw: string): string {
    const r = normalizeRole(roleRaw);
    if (!r) return "Unknown";
    if (r.includes("admin")) return "Admin";
    if (r.includes("counselor") || r.includes("counsellor")) return "Counselor";
    if (r.includes("student")) return "Student";
    if (r.includes("guest")) return "Guest";
    return roleRaw.trim() ? roleRaw.trim() : "Other";
}

function safeUserName(u: AdminUser): string {
    const name = String(u.name ?? "").trim();
    if (name) return name;
    const email = String(u.email ?? "").trim();
    return email || `User #${String(u.id)}`;
}

function safeCreatedAtTs(u: AdminUser): number {
    const t = Date.parse(String(u.created_at ?? ""));
    return Number.isFinite(t) ? t : 0;
}

const AdminOverview: React.FC = () => {
    const [roles, setRoles] = React.useState<string[]>([]);
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [lastUpdated, setLastUpdated] = React.useState<string>("");
    const [snapshotNowTs, setSnapshotNowTs] = React.useState<number>(0);

    const fetchAll = React.useCallback(async () => {
        const [rolesRes, usersRes] = await Promise.all([
            apiFetch<RolesResponse>("/admin/roles", { method: "GET" }),
            apiFetch<UsersResponse>("/admin/users", { method: "GET" }),
        ]);

        setRoles(extractRoles(rolesRes));
        setUsers(extractUsers(usersRes));
    }, []);

    const reload = React.useCallback(
        async (mode: "initial" | "refresh" = "refresh") => {
            if (mode === "initial") setIsLoading(true);
            else setIsRefreshing(true);

            try {
                await fetchAll();

                const nowTs = Date.now(); // ✅ called in handler, not render
                setSnapshotNowTs(nowTs);
                setLastUpdated(format(new Date(nowTs), "MMM d, yyyy – h:mm a"));

                if (mode !== "initial") toast.success("Overview refreshed.");
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to load admin overview.";
                toast.error(msg);
            } finally {
                if (mode === "initial") setIsLoading(false);
                else setIsRefreshing(false);
            }
        },
        [fetchAll],
    );

    React.useEffect(() => {
        void reload("initial");
    }, [reload]);

    const effectiveRoles = React.useMemo(() => {
        const clean = roles.map((r) => String(r).trim()).filter(Boolean);
        const base = clean.length > 0 ? clean : [...FALLBACK_ROLES];

        const seen = new Set<string>();
        const uniq: string[] = [];

        for (const r of base) {
            const key = normalizeRole(r);
            if (!seen.has(key)) {
                seen.add(key);
                uniq.push(r);
            }
        }
        return uniq;
    }, [roles]);

    const stats = React.useMemo(() => {
        const total = users.length;

        let admins = 0;
        let counselors = 0;
        let students = 0;
        let guests = 0;
        let unknown = 0;

        const counts = new Map<string, number>();

        for (const u of users) {
            const raw = String(u.role ?? "");
            const norm = normalizeRole(raw);

            if (!norm) unknown += 1;
            else if (norm.includes("admin")) admins += 1;
            else if (norm.includes("counselor") || norm.includes("counsellor")) counselors += 1;
            else if (norm.includes("student")) students += 1;
            else if (norm.includes("guest")) guests += 1;

            const label = niceRoleLabel(raw);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }

        const roleData = Array.from(counts.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const topRoles = roleData.slice(0, 6);

        const cutoff = snapshotNowTs > 0 ? snapshotNowTs - 7 * DAY_MS : 0;
        const newLast7 =
            cutoff > 0
                ? users.filter((u) => safeCreatedAtTs(u) >= cutoff).length
                : 0;

        const recentUsers = [...users]
            .sort((a, b) => safeCreatedAtTs(b) - safeCreatedAtTs(a))
            .slice(0, 8)
            .map((u) => ({
                id: u.id,
                name: safeUserName(u),
                email: String(u.email ?? ""),
                role: niceRoleLabel(String(u.role ?? "")),
                created_at: u.created_at ? String(u.created_at) : "",
            }));

        return {
            total,
            admins,
            counselors,
            students,
            guests,
            unknown,
            topRoles,
            roleData,
            newLast7,
            recentUsers,
        };
    }, [users, snapshotNowTs]);

    return (
        <DashboardLayout
            title="Overview"
            description="Admin dashboard overview for User Management."
        >
            <div className="mx-auto w-full max-w-6xl space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-xs text-amber-900">
                        <p className="font-semibold">Admin Overview</p>
                        <p className="text-[0.7rem] text-amber-900/80">
                            Quick snapshot of users and role distribution.
                            {lastUpdated ? <span className="ml-2">Last updated: {lastUpdated}</span> : null}
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <Button
                            asChild
                            size="sm"
                            className="w-full gap-2 sm:w-auto"
                            disabled={isLoading}
                        >
                            <Link to="/dashboard/admin/users">
                                <Users className="h-4 w-4" />
                                Manage users
                            </Link>
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void reload("refresh")}
                            disabled={isRefreshing || isLoading}
                            className="w-full gap-2 sm:w-auto"
                        >
                            {isRefreshing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCcw className="h-4 w-4" />
                            )}
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <Users className="h-4 w-4 text-amber-600" />
                                Total users
                            </CardTitle>
                            <CardDescription className="text-xs">All accounts</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.total}
                            <div className="mt-1 text-[0.7rem] font-normal text-muted-foreground">
                                New (last 7 days): <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.newLast7}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <Shield className="h-4 w-4 text-amber-600" />
                                Admins
                            </CardTitle>
                            <CardDescription className="text-xs">System access</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.admins}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <HeartHandshake className="h-4 w-4 text-amber-600" />
                                Counselors
                            </CardTitle>
                            <CardDescription className="text-xs">Support staff</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.counselors}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <GraduationCap className="h-4 w-4 text-amber-600" />
                                Students
                            </CardTitle>
                            <CardDescription className="text-xs">Learners</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.students}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                <UserCog className="h-4 w-4 text-amber-600" />
                                Guests / Other
                            </CardTitle>
                            <CardDescription className="text-xs">Non-student accounts</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-bold text-amber-900">
                            {isLoading ? "—" : stats.guests + stats.unknown}
                            <div className="mt-1 text-[0.7rem] font-normal text-muted-foreground">
                                Guests: <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.guests}</span>
                                {" • "}
                                Unknown: <span className="font-semibold text-amber-900">{isLoading ? "—" : stats.unknown}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Roles + charts */}
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Role distribution
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Based on current users table (admin/users).
                            </CardDescription>
                            <Separator />
                            <div className="text-xs text-muted-foreground">
                                Available roles:{" "}
                                <span className="font-medium text-foreground">
                                    {effectiveRoles.length ? effectiveRoles.join(", ") : "—"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading overview...
                                </div>
                            ) : stats.roleData.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                    No users to summarize yet.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.roleData}
                                                dataKey="value"
                                                nameKey="name"
                                                outerRadius={90}
                                                innerRadius={50}
                                                paddingAngle={2}
                                            >
                                                {stats.roleData.map((_, idx) => (
                                                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-sm font-semibold text-amber-900">
                                Top roles
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Highest user counts by role label.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading chart...
                                </div>
                            ) : stats.topRoles.length === 0 ? (
                                <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                    No role data.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.topRoles} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent users */}
                <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-amber-900">
                                    Recently added users
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Latest accounts (sorted by created_at when available).
                                </CardDescription>
                            </div>

                            <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                disabled={isLoading}
                            >
                                <Link to="/dashboard/admin/users">Open user list</Link>
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading users...
                            </div>
                        ) : stats.recentUsers.length === 0 ? (
                            <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-8 text-center text-xs text-muted-foreground">
                                No users found.
                            </div>
                        ) : (
                            <div className="overflow-auto rounded-md border bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[90px]">ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="w-40">Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.recentUsers.map((u) => (
                                            <TableRow key={String(u.id)}>
                                                <TableCell className="text-xs text-muted-foreground">{String(u.id)}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-foreground">{u.name}</div>
                                                    {u.created_at ? (
                                                        <div className="text-[0.7rem] text-muted-foreground">
                                                            Created: {u.created_at}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[0.7rem] text-muted-foreground">Created: —</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                                                <TableCell className="text-sm">{u.role}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AdminOverview;
