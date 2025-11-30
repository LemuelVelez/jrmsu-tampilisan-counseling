import React from "react";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title = "Dashboard",
    description,
    actions,
    className,
    ...props
}) => {
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
                        {title}
                    </h1>
                    {description && (
                        <p className="text-xs text-muted-foreground md:text-sm">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
                <div className="hidden w-full max-w-xs items-center md:flex">
                    <Input
                        type="search"
                        placeholder="Search…"
                        className="h-8 bg-muted/60 text-xs md:text-sm"
                    />
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Notifications"
                >
                    <Bell className="h-4 w-4" />
                </Button>

                {actions}
            </div>
        </header>
    );
};

export default DashboardHeader;
