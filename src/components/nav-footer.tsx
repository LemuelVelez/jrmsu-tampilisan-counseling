import React from "react";

import {
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

export const NavFooter: React.FC = () => {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <NavUser />
            </SidebarMenuItem>
        </SidebarMenu>
    );
};
