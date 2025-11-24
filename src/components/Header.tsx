import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetClose,
} from "@/components/ui/sheet";
import { PanelLeftIcon } from "lucide-react";
import ecounselingLogo from "@/assets/images/ecounseling.svg";

const Header: React.FC = () => {
    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
                {/* Logo / brand */}
                <Link to="/" className="flex items-center gap-2">
                    <img
                        src={ecounselingLogo}
                        alt="eCounseling logo"
                        className="h-9 w-9"
                    />
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold tracking-tight">
                            eCounseling
                        </span>
                        <span className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.12em]">
                            JRMSU – Tampilisan Campus
                        </span>
                    </div>
                </Link>

                {/* Desktop navigation */}
                <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
                    <a href="#hero" className="text-muted-foreground hover:text-foreground">
                        Home
                    </a>
                    <a
                        href="#benefits"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Benefits
                    </a>
                    <a
                        href="#how-it-works"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        How it works
                    </a>
                    <a
                        href="#contact"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Contact
                    </a>
                </nav>

                {/* Right side: desktop button + mobile sheet trigger */}
                <div className="flex items-center gap-2">
                    {/* Desktop Sign in (unchanged for md and up) */}
                    <Button size="sm" asChild className="hidden md:inline-flex">
                        <Link to="/auth">Sign in</Link>
                    </Button>

                    {/* Mobile: Sheet-based nav triggered by a sidebar-style button */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="inline-flex size-8 items-center justify-center md:hidden"
                                aria-label="Open navigation"
                            >
                                <PanelLeftIcon className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>

                        <SheetContent
                            side="right"
                            className="md:hidden h-full bg-background/95 px-4 pb-8 pt-6 backdrop-blur border-l"
                        >
                            <SheetHeader className="px-0 pt-0">
                                <SheetTitle>
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={ecounselingLogo}
                                            alt="eCounseling logo"
                                            className="h-9 w-9"
                                        />
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-sm font-semibold tracking-tight">
                                                eCounseling
                                            </span>
                                            <span className="text-[0.7rem] text-muted-foreground uppercase tracking-[0.12em]">
                                                JRMSU – Tampilisan Campus
                                            </span>
                                        </div>
                                    </div>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 flex h-full flex-col gap-6">
                                {/* Mobile nav inside sheet */}
                                <nav className="flex flex-col gap-2 text-sm font-medium">
                                    <SheetClose asChild>
                                        <a
                                            href="#hero"
                                            className="rounded-md px-2 py-2 text-left text-foreground hover:bg-amber-50"
                                        >
                                            Home
                                        </a>
                                    </SheetClose>
                                    <SheetClose asChild>
                                        <a
                                            href="#benefits"
                                            className="rounded-md px-2 py-2 text-left text-foreground hover:bg-amber-50"
                                        >
                                            Benefits
                                        </a>
                                    </SheetClose>
                                    <SheetClose asChild>
                                        <a
                                            href="#how-it-works"
                                            className="rounded-md px-2 py-2 text-left text-foreground hover:bg-amber-50"
                                        >
                                            How it works
                                        </a>
                                    </SheetClose>
                                    <SheetClose asChild>
                                        <a
                                            href="#contact"
                                            className="rounded-md px-2 py-2 text-left text-foreground hover:bg-amber-50"
                                        >
                                            Contact
                                        </a>
                                    </SheetClose>
                                </nav>

                                {/* Mobile Sign in button inside sheet */}
                                <div className="mt-auto">
                                    <SheetClose asChild>
                                        <Button className="w-full" size="sm" asChild>
                                            <Link to="/auth">Sign in</Link>
                                        </Button>
                                    </SheetClose>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
};

export default Header;
