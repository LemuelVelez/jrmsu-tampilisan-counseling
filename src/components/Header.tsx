import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Header: React.FC = () => {
    const handleExploreClick = () => {
        const section = document.getElementById("how-it-works");
        if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
                <Link to="/" className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-yellow-400 to-amber-500 text-sm font-bold text-amber-950 shadow-sm">
                        eC
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold tracking-tight">
                            eCounseling
                        </span>
                        <span className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.12em]">
                            JRMSU – Tampilisan Campus
                        </span>
                    </div>
                </Link>

                <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
                    <a href="#benefits" className="text-muted-foreground hover:text-foreground">
                        Benefits
                    </a>
                    <a href="#how-it-works" className="text-muted-foreground hover:text-foreground">
                        How it works
                    </a>
                    <a href="#contact" className="text-muted-foreground hover:text-foreground">
                        Contact
                    </a>
                </nav>

                <div className="flex items-center gap-2">
                    {/* EXPLORE: now smoothly scrolls to the How It Works section */}
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={handleExploreClick}
                    >
                        Explore
                    </Button>

                    <Button size="sm" asChild>
                        <Link to="/auth">Sign in</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default Header;
