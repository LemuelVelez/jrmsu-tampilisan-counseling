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
                "flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6",
                className,
            )}
            {...props}
        >
            <div className="flex flex-1 items-center gap-3">
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

            {actions && (
                <div className="ml-auto flex items-center gap-2">
                    {actions}
                </div>
            )}
        </header>
    );
};

export default DashboardHeader;
