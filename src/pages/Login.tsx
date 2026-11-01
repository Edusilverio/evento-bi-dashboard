import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Waves, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const MSG_NAO_AUTORIZADO = "Este e-mail não tem acesso ao painel. Fale com a administração.";
const MSG_PROVIDER_OFF = "Login com Google ainda não está ativo.";

function traduzErroOAuth(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("email_nao_autorizado") || t.includes("não autorizado") || t.includes("nao autorizado")) {
    return MSG_NAO_AUTORIZADO;
  }
  if (t.includes("unsupported provider") || t.includes("provider is not enabled")) {
    return MSG_PROVIDER_OFF;
  }
  if (t.includes("database error") || t.includes("unexpected_failure") || t.includes("server_error")) {
    return MSG_NAO_AUTORIZADO;
  }
  return "Não foi possível entrar com o Google. Tente novamente.";
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Lê erro de OAuth devolvido na query string ou no hash
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const raw =
      query.get("error_description") || query.get("error") ||
      hash.get("error_description") || hash.get("error");
    if (raw) {
      setError(traduzErroOAuth(decodeURIComponent(raw)));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (oauthError) {
      setError(traduzErroOAuth(oauthError.message));
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login")) {
          setError("Email ou senha incorretos");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("Confirme seu email antes de fazer login");
        } else {
          setError(authError.message);
        }
        return;
      }

      // Check if user is active
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("id", data.user.id)
          .single();

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          setError("Sua conta está desativada. Contate o administrador.");
          return;
        }
      }

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px] bottom-20 right-20 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md mx-4 relative z-10"
      >
        <div className="glass-card p-8 border border-border relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
              <Waves className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Coral Moment</h1>
            <p className="text-sm text-muted-foreground mt-1">Dashboard BI</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full relative z-20"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.87Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.17 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
              </svg>
            )}
            Entrar com Google
          </Button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/50 border-border relative z-20"
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setError("Funcionalidade de recuperação de senha em breve.")}
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border relative z-20"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
