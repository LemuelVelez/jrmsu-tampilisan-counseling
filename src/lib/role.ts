import type { Role } from "@/lib/authentication";

export type DashboardPath =
    | "/dashboard/admin"
    | "/dashboard/counselor"
    | "/dashboard/student";

/**
 * Normalize any backend-provided role value to a lowercase string.
 */
export function normalizeRole(
    role: string | Role | null | undefined,
): string {
    if (role == null) return "";
    return String(role).trim().toLowerCase();
}

/**
 * Given a role, return the correct dashboard path.
 * Used by the auth page and the generic /dashboard route.
 */
export function resolveDashboardPathForRole(
    role: string | Role | null | undefined,
): DashboardPath {
    const normalized = normalizeRole(role);

    if (normalized.includes("admin")) {
        return "/dashboard/admin";
    }

    if (normalized.includes("counselor") || normalized.includes("counsellor")) {
        return "/dashboard/counselor";
    }

    // Default / fallback to student dashboard
    return "/dashboard/student";
}
