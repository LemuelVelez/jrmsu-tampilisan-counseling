import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingProps {
    /**
     * Optional label shown under the spinner.
     * Defaults to "Loading...".
     */
    label?: string;
}

const Loading: React.FC<LoadingProps> = ({ label = "Loading..." }) => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-white/40">
            <div className="flex flex-col items-center gap-3 text-amber-900">
                <Loader2
                    className="h-8 w-8 animate-spin"
                    aria-hidden="true"
                />
                <p className="text-sm font-medium">{label}</p>
            </div>
        </div>
    );
};

export default Loading;
