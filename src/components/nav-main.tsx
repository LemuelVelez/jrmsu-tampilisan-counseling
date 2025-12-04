import React from "react";
import {
    LayoutDashboard,
    CalendarClock,
    ClipboardList,
    MessageCircle,
    Settings,
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

type NavItem = {
    title: string;
    to: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const studentNavItems: NavItem[] = [
    {
        title: "Overview",
        to: "/dashboard/student",
        icon: LayoutDashboard,
    },
    {
        // Counseling Request / Intake
        title: "Intake",
        to: "/dashboard/student/intake",
        icon: ClipboardList,
    },
    {
        // Messages between student & Guidance Office
        title: "Messages",
        to: "/dashboard/student/messages",
        icon: MessageCircle,
    },
    {
        // Evaluation (Appointments & Assessment history)
        title: "Evaluation",
        to: "/dashboard/student/evaluation",
        icon: CalendarClock,
    },
    {
        // Account settings: password + avatar
        title: "Settings",
        to: "/dashboard/student/settings",
        icon: Settings,
    },
];

export const NavMain: React.FC = () => {
    const location = useLocation();

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Student</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {studentNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.to;

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
                                    <Link to={item.to}>
                                        <Icon />
                                        <span>{item.title}</span>
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
