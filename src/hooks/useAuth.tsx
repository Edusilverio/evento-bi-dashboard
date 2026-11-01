import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isFinanceiro: boolean;
  roles: string[];
  hasAnyRole: boolean;
  isLoading: boolean;
  profile: { full_name: string; email: string; is_active: boolean } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isFinanceiro: false,
  roles: [],
  hasAnyRole: false,
  isLoading: true,
  profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFinanceiro, setIsFinanceiro] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          // Defer DB queries to avoid deadlocks
          setTimeout(async () => {
            try {
              const [profileRes, roleRes] = await Promise.all([
                supabase.from("profiles").select("full_name, email, is_active").eq("id", sess.user.id).single(),
                supabase.from("user_roles").select("role").eq("user_id", sess.user.id),
              ]);
              setProfile(profileRes.data as any);
              const userRoles = (roleRes.data ?? []).map((r: { role: string }) => r.role);
              setRoles(userRoles);
              setIsAdmin(userRoles.includes("admin"));
              setIsFinanceiro(userRoles.includes("financeiro"));

              // Update last_login
              if (event === "SIGNED_IN") {
                supabase.rpc("update_last_login", { _user_id: sess.user.id });
              }
            } catch (e) {
              console.error("Error fetching auth data:", e);
            }
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setIsAdmin(false);
          setIsFinanceiro(false);
          setIsLoading(false);
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!sess) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsAdmin(false);
    setIsFinanceiro(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isFinanceiro, roles, hasAnyRole: roles.length > 0, isLoading, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
