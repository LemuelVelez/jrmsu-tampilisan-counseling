/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import {
    Loader2,
    RefreshCcw,
    Search,
    Eye,
    EyeOff,
    UserPlus,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { AUTH_API_BASE_URL, type AuthenticatedUserDto } from "@/api/auth/route";
import {
    getCurrentSession,
    subscribeToSession,
    type AuthSession,
} from "@/lib/authentication";
import { normalizeRole, resolveDashboardPathForRole } from "@/lib/role";

type AdminUser = AuthenticatedUserDto & {
    role?: string | null;
    avatar_url?: string | null;
};

type RolesResponse =
    | string[]
    | { roles?: string[]; data?: string[];[k: string]: unknown };

type UsersResponse =
    | AdminUser[]
    | { users?: AdminUser[]; data?: AdminUser[];[k: string]: unknown };

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

function extractUserFromCreateResponse(payload: any): AdminUser | null {
    const candidate = payload?.user ?? payload?.data ?? payload?.created_user ?? null;
    if (!candidate || candidate.id == null || !candidate.email) return null;
    return candidate as AdminUser;
}

function getInitials(name?: string | null, email?: string | null): string {
    const base = (name ?? "").trim();
    if (base) {
        const parts = base.split(/\s+/);
        if (parts.length === 1) return (parts[0][0] ?? "U").toUpperCase();
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`
            .toUpperCase()
            .slice(0, 2);
    }
    return (email?.[0] ?? "U").toUpperCase();
}

const FALLBACK_ROLES = ["admin", "counselor", "student"] as const;

/**
 * Subscribe to global auth session (same approach as NavMain).
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

type CreateUserForm = {
    name: string;
    email: string;
    role: string;
    gender: string;
    password: string;
    password_confirmation: string;
};

const AdminUsersInner: React.FC = () => {
    const [roles, setRoles] = React.useState<string[]>([]);
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [query, setQuery] = React.useState("");
    const [updatingIds, setUpdatingIds] = React.useState<Set<string | number>>(
        () => new Set(),
    );

    const [avatarOpen, setAvatarOpen] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);

    // Add user dialog
    const [createOpen, setCreateOpen] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [showCreatePassword, setShowCreatePassword] = React.useState(false);
    const [showCreateConfirmPassword, setShowCreateConfirmPassword] =
        React.useState(false);
    const [createForm, setCreateForm] = React.useState<CreateUserForm>({
        name: "",
        email: "",
        role: "student",
        gender: "",
        password: "",
        password_confirmation: "",
    });

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

    // Keep default create role aligned if roles load later
    React.useEffect(() => {
        setCreateForm((prev) => {
            const prevRoleNorm = normalizeRole(prev.role);
            const inList = effectiveRoles.some(
                (r) => normalizeRole(r) === prevRoleNorm,
            );
            if (inList) return prev;

            // Prefer student if present, else first role
            const preferred =
                effectiveRoles.find((r) => normalizeRole(r) === "student") ??
                effectiveRoles[0] ??
                "student";

            return { ...prev, role: preferred };
        });
    }, [effectiveRoles]);

    const fetchAll = React.useCallback(async () => {
        // NOTE: Adjust these endpoints to match your Laravel routes if needed.
        // Suggested:
        //   GET /admin/roles
        //   GET /admin/users
        const [rolesRes, usersRes] = await Promise.all([
            apiFetch<RolesResponse>("/admin/roles", { method: "GET" }),
            apiFetch<UsersResponse>("/admin/users", { method: "GET" }),
        ]);

        setRoles(extractRoles(rolesRes));
        setUsers(extractUsers(usersRes));
    }, []);

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            setIsLoading(true);
            try {
                await fetchAll();
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "Failed to load users.";
                toast.error(msg);
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [fetchAll]);

    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchAll();
            toast.success("Refreshed users & roles.");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to refresh.";
            toast.error(msg);
        } finally {
            setIsRefreshing(false);
        }
    };

    const filteredUsers = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;

        return users.filter((u) => {
            const name = String(u.name ?? "").toLowerCase();
            const email = String(u.email ?? "").toLowerCase();
            const role = String(u.role ?? "").toLowerCase();
            return name.includes(q) || email.includes(q) || role.includes(q);
        });
    }, [users, query]);

    const openAvatarDialog = (user: AdminUser) => {
        setSelectedUser(user);
        setAvatarOpen(true);
    };

    const updateUserInState = (
        id: string | number,
        partial: Partial<AdminUser>,
    ) => {
        setUsers((prev) =>
            prev.map((u) =>
                String(u.id) === String(id) ? { ...u, ...partial } : u,
            ),
        );
    };

    const handleRoleChange = async (user: AdminUser, nextRoleRaw: string) => {
        const nextRole = String(nextRoleRaw ?? "").trim();
        const prevRole = String(user.role ?? "").trim();
        if (!nextRole || normalizeRole(nextRole) === normalizeRole(prevRole)) return;

        const userId = user.id;

        // Optimistic UI
        updateUserInState(userId, { role: nextRole });
        setUpdatingIds((prev) => new Set(prev).add(userId));

        try {
            // NOTE: Adjust endpoint/payload to match your backend.
            // Suggested:
            //   PATCH /admin/users/:id/role  body: { role: "counselor" }
            const res = await apiFetch<any>(`/admin/users/${userId}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role: nextRole }),
            });

            const updated = (res?.user ?? res?.data ?? null) as AdminUser | null;
            if (updated?.id != null) {
                updateUserInState(userId, {
                    role: updated.role ?? nextRole,
                    avatar_url: updated.avatar_url ?? user.avatar_url ?? null,
                    name: updated.name ?? user.name ?? null,
                    email: updated.email ?? user.email,
                });
            }

            toast.success(res?.message ?? `Role updated to "${nextRole}".`);
        } catch (err) {
            // Revert optimistic UI
            updateUserInState(userId, { role: prevRole });
            const msg =
                err instanceof Error ? err.message : "Failed to update role.";
            toast.error(msg);
        } finally {
            setUpdatingIds((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    const resetCreateForm = () => {
        const preferredRole =
            effectiveRoles.find((r) => normalizeRole(r) === "student") ??
            effectiveRoles[0] ??
            "student";

        setCreateForm({
            name: "",
            email: "",
            role: preferredRole,
            gender: "",
            password: "",
            password_confirmation: "",
        });
        setShowCreatePassword(false);
        setShowCreateConfirmPassword(false);
    };

    const openCreateDialog = () => {
        resetCreateForm();
        setCreateOpen(true);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();

        const name = createForm.name.trim();
        const email = createForm.email.trim();
        const role = createForm.role.trim();
        const gender = createForm.gender.trim();
        const password = createForm.password;
        const passwordConfirmation = createForm.password_confirmation;

        if (!name) {
            toast.error("Please enter the user's full name.");
            return;
        }
        if (!email) {
            toast.error("Please enter the user's email.");
            return;
        }
        if (!role) {
            toast.error("Please select a role.");
            return;
        }
        if (!password || password.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
        }
        if (password !== passwordConfirmation) {
            toast.error("Password confirmation does not match.");
            return;
        }

        setIsCreating(true);

        try {
            /**
             * NOTE: Adjust endpoint/payload to match your backend.
             * Suggested:
             *   POST /admin/users
             *   body: { name, email, role, password, password_confirmation, gender? }
             */
            const res = await apiFetch<any>("/admin/users", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    email,
                    role,
                    password,
                    password_confirmation: passwordConfirmation,
                    ...(gender ? { gender } : {}),
                }),
            });

            const created = extractUserFromCreateResponse(res);

            if (created) {
                // Prepend new user for instant feedback
                setUsers((prev) => [created, ...prev]);
            } else {
                // Fallback: reload list if backend doesn't return created user
                await fetchAll();
            }

            toast.success(res?.message ?? "User created successfully.");
            setCreateOpen(false);
            setSelectedUser(null);
            resetCreateForm();
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to create user.";
            toast.error(msg);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <DashboardLayout
            title="Users"
            description="View all users, check avatars, update user roles, and add new users."
        >
            <div className="space-y-6">
                <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-amber-900">
                                    User Management
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Roles available:{" "}
                                    {effectiveRoles.length > 0
                                        ? effectiveRoles.join(", ")
                                        : "—"}
                                </CardDescription>
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                <div className="relative w-full sm:w-[320px]">
                                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search name, email, role..."
                                        className="h-9 pl-8 text-sm"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={openCreateDialog}
                                        className="gap-2"
                                        disabled={isLoading}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Add user
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={onRefresh}
                                        disabled={isRefreshing || isLoading}
                                        className="gap-2"
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
                        </div>

                        <Separator />
                        <div className="text-xs text-muted-foreground">
                            Showing{" "}
                            <span className="font-medium text-foreground">
                                {filteredUsers.length}
                            </span>{" "}
                            of{" "}
                            <span className="font-medium text-foreground">
                                {users.length}
                            </span>{" "}
                            users
                        </div>
                    </CardHeader>

                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading users...
                            </div>
                        ) : (
                            <div className="overflow-auto rounded-md border bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">Avatar</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="w-[180px]">Role</TableHead>
                                            <TableHead className="w-[140px] text-right">
                                                View
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filteredUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="py-10 text-center text-sm text-muted-foreground"
                                                >
                                                    No users found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredUsers.map((u) => {
                                                const idKey = String(u.id);
                                                const isUpdating = updatingIds.has(u.id);

                                                const avatarUrl =
                                                    typeof u.avatar_url === "string" &&
                                                        u.avatar_url.trim()
                                                        ? u.avatar_url.trim()
                                                        : null;

                                                const initials = getInitials(
                                                    u.name ?? null,
                                                    u.email ?? null,
                                                );

                                                const currentRole = String(u.role ?? "");

                                                const roleNotInList =
                                                    currentRole &&
                                                    !effectiveRoles.some(
                                                        (r) =>
                                                            normalizeRole(r) ===
                                                            normalizeRole(currentRole),
                                                    );

                                                return (
                                                    <TableRow key={idKey}>
                                                        <TableCell>
                                                            <button
                                                                type="button"
                                                                className="rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300"
                                                                onClick={() => openAvatarDialog(u)}
                                                                aria-label="View avatar"
                                                            >
                                                                <Avatar className="h-9 w-9 border border-amber-100 bg-amber-50">
                                                                    {avatarUrl ? (
                                                                        <AvatarImage
                                                                            src={avatarUrl}
                                                                            alt={u.name ?? "User avatar"}
                                                                            className="object-cover"
                                                                        />
                                                                    ) : (
                                                                        <AvatarFallback className="bg-amber-100 text-[0.7rem] font-semibold text-amber-900">
                                                                            {initials}
                                                                        </AvatarFallback>
                                                                    )}
                                                                </Avatar>
                                                            </button>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <div className="font-medium text-foreground">
                                                                {u.name ?? "—"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                ID: {String(u.id)}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {u.email}
                                                        </TableCell>

                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    className="h-9 w-full rounded-md border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                                                                    value={currentRole}
                                                                    disabled={isUpdating}
                                                                    onChange={(e) =>
                                                                        handleRoleChange(u, e.target.value)
                                                                    }
                                                                >
                                                                    {roleNotInList ? (
                                                                        <option value={currentRole}>
                                                                            {currentRole}
                                                                        </option>
                                                                    ) : null}

                                                                    {effectiveRoles.map((r) => (
                                                                        <option key={r} value={r}>
                                                                            {r}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                {isUpdating ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                                ) : null}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-2"
                                                                onClick={() => openAvatarDialog(u)}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                                View
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* View avatar dialog */}
                <Dialog
                    open={avatarOpen}
                    onOpenChange={(open) => {
                        setAvatarOpen(open);
                        if (!open) setSelectedUser(null);
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-semibold text-amber-900">
                                User Avatar
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {selectedUser?.name ?? "User"} •{" "}
                                {selectedUser?.email ?? ""}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col items-center gap-4">
                            <div className="w-full overflow-hidden rounded-lg border bg-white">
                                {selectedUser?.avatar_url ? (
                                    <img
                                        src={selectedUser.avatar_url}
                                        alt={selectedUser?.name ?? "User avatar"}
                                        className="h-auto w-full object-contain"
                                    />
                                ) : (
                                    <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
                                        No avatar uploaded.
                                    </div>
                                )}
                            </div>

                            <Button
                                type="button"
                                onClick={() => setAvatarOpen(false)}
                                className="w-full"
                            >
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Add user dialog */}
                <Dialog
                    open={createOpen}
                    onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) {
                            setIsCreating(false);
                            resetCreateForm();
                        }
                    }}
                >
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-semibold text-amber-900">
                                Add new user
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Create an account and assign a role. (Endpoint expected:{" "}
                                <span className="font-medium text-foreground">
                                    POST /admin/users
                                </span>
                                )
                            </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-4" onSubmit={handleCreateUser}>
                            <div className="space-y-2">
                                <Label className="text-xs" htmlFor="create-name">
                                    Full name
                                </Label>
                                <Input
                                    id="create-name"
                                    value={createForm.name}
                                    onChange={(e) =>
                                        setCreateForm((p) => ({ ...p, name: e.target.value }))
                                    }
                                    placeholder="Juan Dela Cruz"
                                    className="h-9 text-sm"
                                    autoComplete="name"
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs" htmlFor="create-email">
                                    Email
                                </Label>
                                <Input
                                    id="create-email"
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) =>
                                        setCreateForm((p) => ({ ...p, email: e.target.value }))
                                    }
                                    placeholder="user@example.com"
                                    className="h-9 text-sm"
                                    autoComplete="email"
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="create-role">
                                        Role
                                    </Label>
                                    <select
                                        id="create-role"
                                        className="h-9 w-full rounded-md border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                                        value={createForm.role}
                                        onChange={(e) =>
                                            setCreateForm((p) => ({ ...p, role: e.target.value }))
                                        }
                                        disabled={isCreating}
                                    >
                                        {effectiveRoles.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="create-gender">
                                        Gender (optional)
                                    </Label>
                                    <select
                                        id="create-gender"
                                        className="h-9 w-full rounded-md border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                                        value={createForm.gender}
                                        onChange={(e) =>
                                            setCreateForm((p) => ({
                                                ...p,
                                                gender: e.target.value,
                                            }))
                                        }
                                        disabled={isCreating}
                                    >
                                        <option value="">—</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="nonbinary">Non-binary</option>
                                        <option value="prefer-not-to-say">Prefer not to say</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="create-password">
                                        Password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-password"
                                            type={showCreatePassword ? "text" : "password"}
                                            value={createForm.password}
                                            onChange={(e) =>
                                                setCreateForm((p) => ({
                                                    ...p,
                                                    password: e.target.value,
                                                }))
                                            }
                                            placeholder="At least 8 characters"
                                            className="h-9 pr-10 text-sm"
                                            autoComplete="new-password"
                                            disabled={isCreating}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                            onClick={() =>
                                                setShowCreatePassword((prev) => !prev)
                                            }
                                            aria-label={
                                                showCreatePassword
                                                    ? "Hide password"
                                                    : "Show password"
                                            }
                                            disabled={isCreating}
                                        >
                                            {showCreatePassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs" htmlFor="create-password-confirm">
                                        Confirm password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-password-confirm"
                                            type={showCreateConfirmPassword ? "text" : "password"}
                                            value={createForm.password_confirmation}
                                            onChange={(e) =>
                                                setCreateForm((p) => ({
                                                    ...p,
                                                    password_confirmation: e.target.value,
                                                }))
                                            }
                                            placeholder="Re-enter password"
                                            className="h-9 pr-10 text-sm"
                                            autoComplete="new-password"
                                            disabled={isCreating}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                                            onClick={() =>
                                                setShowCreateConfirmPassword((prev) => !prev)
                                            }
                                            aria-label={
                                                showCreateConfirmPassword
                                                    ? "Hide password"
                                                    : "Show password"
                                            }
                                            disabled={isCreating}
                                        >
                                            {showCreateConfirmPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCreateOpen(false)}
                                    disabled={isCreating}
                                >
                                    Cancel
                                </Button>

                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        "Create user"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
};

const AdminUsersPage: React.FC = () => {
    // ✅ Hooks are always called, no conditional hook usage.
    const session = useAuthSession();
    const me = session.user;
    const myRole = normalizeRole(me?.role ?? "");

    if (!me) return <Navigate to="/auth" replace />;

    if (!myRole.includes("admin")) {
        const dashboardPath = resolveDashboardPathForRole(me.role ?? "");
        return <Navigate to={dashboardPath} replace />;
    }

    return <AdminUsersInner />;
};

export default AdminUsersPage;
