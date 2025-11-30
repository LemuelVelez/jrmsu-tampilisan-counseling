import React from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
} from "@/components/ui/sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { NavHeader } from "@/components/nav-header";
import { NavMain } from "@/components/nav-main";
import { NavFooter } from "@/components/nav-footer";

interface DashboardLayoutProps {
    title?: string;
    description?: string;
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    title = "Dashboard",
    description,
    children,
}) => {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-muted/40">
                <Sidebar variant="inset">
                    <SidebarHeader>
                        <NavHeader />
                    </SidebarHeader>

                    <SidebarContent>
                        <NavMain />
                    </SidebarContent>

                    <SidebarFooter>
                        <NavFooter />
                    </SidebarFooter>

                    <SidebarRail />
                </Sidebar>

                <SidebarInset>
                    <DashboardHeader
                        title={title}
                        description={description}
                    />

                    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                        {children}
                    </div>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};

export default DashboardLayout;
