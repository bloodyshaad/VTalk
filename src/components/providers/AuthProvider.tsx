import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";

const AuthContext = createContext<typeof useAuthStore | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const profile = useAuthStore((s) => s.profile);
  const initMessages = useMessageStore((s) => s.init);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (profile) void initMessages();
  }, [profile, initMessages]);

  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  return ctx;
}
