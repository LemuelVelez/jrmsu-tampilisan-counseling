import React from "react";
import { Link } from "react-router-dom";

import ecounselingLogo from "@/assets/images/ecounseling.svg";

export const NavHeader: React.FC = () => {
    return (
        <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
        >
            <img
                src={ecounselingLogo}
                alt="eCounseling logo"
                className="h-8 w-auto"
            />
            <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">
                    E-Guidance Appointment System
                </span>
                <span className="text-xs text-sidebar-foreground/70">
                    JRMSU – Tampilisan Campus
                </span>
            </div>
        </Link>
    );
};
