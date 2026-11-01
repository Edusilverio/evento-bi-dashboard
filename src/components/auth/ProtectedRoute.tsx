import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/dashboard/DashboardSkeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, hasAnyRole, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAnyRole) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold">Acesso ainda não liberado</h1>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Sua conta existe, mas ainda não tem permissão para ver os dados. Fale com a administração.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        <a href="/dashboard" className="text-primary underline text-sm">Voltar ao Dashboard</a>
      </div>
    );
  }

  return <>{children}</>;
}

export function FinanceiroRoute({ children }: { children: React.ReactNode }) {
  const { user, isFinanceiro, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isFinanceiro) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          A área Financeiro é restrita. Fale com a administração se você precisa desse acesso.
        </p>
        <a href="/dashboard" className="text-primary underline text-sm">Voltar ao Dashboard</a>
      </div>
    );
  }

  return <>{children}</>;
}
