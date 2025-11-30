import React from "react";
import { LayoutDashboard, CalendarClock, LineChart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

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
        title: "My Sessions",
        to: "/dashboard/student/sessions",
        icon: CalendarClock,
    },
    {
        title: "My Progress",
        to: "/dashboard/student/progress",
        icon: LineChart,
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
                                <SidebarMenuButton asChild isActive={isActive}>
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
