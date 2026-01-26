import React from "react";

const Footer: React.FC = () => {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t bg-background/80 backdrop-blur">
            <div className="mx-auto flex flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
                <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight text-amber-900">
                        E-Guidance Appointment System
                    </p>
                    <p className="max-w-xl text-xs text-muted-foreground">
                        A privacy-aware platform for requesting and scheduling guidance appointments,
                        secure messaging, referrals, and reporting. Counseling sessions are conducted
                        outside the system through official guidance processes.
                    </p>
                </div>

                <div className="text-xs text-muted-foreground">
                    © {year} JRMSU – Tampilisan Campus
                </div>
            </div>
        </footer>
    );
};

export default Footer;
