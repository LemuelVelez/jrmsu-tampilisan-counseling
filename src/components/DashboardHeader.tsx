import React from "react";
import { useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface DashboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
}

function getDashboardTitleForPath(pathname: string): string {
    if (pathname.startsWith("/dashboard/admin")) {
        return "Admin Dashboard";
    }

    if (pathname.startsWith("/dashboard/counselor")) {
        return "Counselor Dashboard";
    }

    if (pathname.startsWith("/dashboard/student")) {
        return "Student Dashboard";
    }

    return "Dashboard";
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title = "Dashboard",
    description,
    actions,
    className,
    ...props
}) => {
    const location = useLocation();

    // If a custom title is provided, use it.
    // Otherwise, derive the title based on the current dashboard path (role).
    const resolvedTitle =
        title === "Dashboard" ? getDashboardTitleForPath(location.pathname) : title;

    return (
        <header
            className={cn(
                // Mobile: vertical, auto height, comfortable padding
                // Desktop (md+): same as original - row, fixed height, same gaps & padding
                "flex flex-col gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur md:h-16 md:flex-row md:items-center md:gap-3 md:px-6 md:py-0",
                className,
            )}
            {...props}
        >
            {/* Title + description block */}
            <div className="flex items-start gap-2 md:flex-1 md:items-center md:gap-3">
                <SidebarTrigger className="-ml-1" />
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-base font-semibold leading-tight md:text-lg">
                        {resolvedTitle}
                    </h1>
                    {description && (
                        <p className="text-xs text-muted-foreground md:text-sm">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions block */}
            {actions && (
                <div className="flex flex-wrap items-center justify-end gap-2 md:ml-auto">
                    {actions}
                </div>
            )}
        </header>
    );
};

export default DashboardHeader;
