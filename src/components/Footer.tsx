import React from "react";

const Footer: React.FC = () => {
    const year = new Date().getFullYear();

    return (
        <footer
            id="contact"
            className="mt-16 border-t bg-background/80 backdrop-blur"
        >
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
                <div className="space-y-1">
                    <p className="font-medium text-amber-900">
                        eCounseling – JRMSU Tampilisan Campus
                    </p>
                    <p>
                        A centralized online guidance and counseling system to support
                        student well-being and academic success.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[0.7rem] text-muted-foreground/80">
                        © {year} Jose Rizal Memorial State University – Tampilisan Campus
                    </span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
