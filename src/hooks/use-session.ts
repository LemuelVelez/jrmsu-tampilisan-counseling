import React from "react";
import {
    SESSION_STORAGE_KEY,
    getCurrentSession,
    subscribeToSession,
    loginWithEmailPassword,
    logoutFromServer,
    fetchCurrentUserFromServer,
    type AuthSession,
    type LoginCredentials,
    type LoginResult,
} from "@/lib/authentication";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface UseSessionResult {
    session: AuthSession;
    status: SessionStatus;
    signIn: (credentials: LoginCredentials) => Promise<LoginResult>;
    signOut: () => Promise<void>;
    refresh: () => Promise<AuthSession | null>;
}

export function useSession(): UseSessionResult {
    const [session, setSession] = React.useState<AuthSession>(() =>
        getCurrentSession(),
    );
    const [status, setStatus] = React.useState<SessionStatus>("loading");

    React.useEffect(() => {
        setStatus(session.user ? "authenticated" : "unauthenticated");
    }, [session]);

    React.useEffect(() => {
        const unsubscribe = subscribeToSession((nextSession) => {
            setSession(nextSession);
        });

        // Ensure initial state is up-to-date
        setSession(getCurrentSession());

        const handleStorage = (event: StorageEvent) => {
            if (event.key === SESSION_STORAGE_KEY) {
                setSession(getCurrentSession());
            }
        };

        if (typeof window !== "undefined") {
            window.addEventListener("storage", handleStorage);
        }

        return () => {
            unsubscribe();
            if (typeof window !== "undefined") {
                window.removeEventListener("storage", handleStorage);
            }
        };
    }, []);

    const signIn = React.useCallback(
        async (credentials: LoginCredentials) => {
            const result = await loginWithEmailPassword(credentials);
            // Session state will be updated through our subscription.
            return result;
        },
        [],
    );

    const signOut = React.useCallback(async () => {
        await logoutFromServer();
    }, []);

    const refresh = React.useCallback(async () => {
        return fetchCurrentUserFromServer();
    }, []);

    return { session, status, signIn, signOut, refresh };
}

export default useSession;
