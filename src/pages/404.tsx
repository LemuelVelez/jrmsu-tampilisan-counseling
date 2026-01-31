import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFoundPage: React.FC = () => {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60 px-4">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                    404 • Page not found
                </p>
                <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-amber-900 md:text-4xl">
                    Looks like this page missed its appointment.
                </h1>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                    The page you’re looking for doesn’t exist or has moved. You can return
                    to the eGuidance landing page or sign in to your portal.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button asChild>
                        <Link to="/">Back to home</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/auth">Go to sign in</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
