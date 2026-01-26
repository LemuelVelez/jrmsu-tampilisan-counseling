import type { Role } from "@/lib/authentication";

export type DashboardPath =
    | "/dashboard/admin"
    | "/dashboard/counselor"
    | "/dashboard/student"
    | "/dashboard/referral-user";

/**
 * Normalize any backend-provided role value to a lowercase string.
 */
export function normalizeRole(role: string | Role | null | undefined): string {
    if (role == null) return "";
    return String(role).trim().toLowerCase();
}

/**
 * Given a role, return the correct dashboard path.
 */
export function resolveDashboardPathForRole(role: string | Role | null | undefined): DashboardPath {
    const normalized = normalizeRole(role);

    if (normalized.includes("admin")) {
        return "/dashboard/admin";
    }

    if (normalized.includes("counselor") || normalized.includes("counsellor")) {
        return "/dashboard/counselor";
    }

    // ✅ Referral user roles
    if (
        normalized.includes("referral") ||
        normalized.includes("dean") ||
        normalized.includes("registrar") ||
        normalized.includes("program_chair") ||
        normalized.includes("program chair")
    ) {
        return "/dashboard/referral-user";
    }

    // Default / fallback to student dashboard
    return "/dashboard/student";
}
