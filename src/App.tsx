import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, AdminRoute, FinanceiroRoute } from "@/components/auth/ProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ConsolidadoCM = lazy(() => import("./pages/ConsolidadoCM"));
const GA4 = lazy(() => import("./pages/GA4"));
const MetaAds = lazy(() => import("./pages/MetaAds"));
const GoogleAds = lazy(() => import("./pages/GoogleAds"));
const TikTok = lazy(() => import("./pages/TikTok"));
const Investimento = lazy(() => import("./pages/Investimento"));
const ConsolidadoPR = lazy(() => import("./pages/ConsolidadoPR"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Financeiro = lazy(() => import("./pages/Financeiro"));


const AnalistaIA = lazy(() => import("./pages/AnalistaIA"));
const MetasPV = lazy(() => import("./pages/MetasPV"));
const PassaporteCM = lazy(() => import("./pages/PassaporteCM"));
const SunsetBoatSexta = lazy(() => import("./pages/SunsetBoatSexta"));
const SunsetBoatSabado = lazy(() => import("./pages/SunsetBoatSabado"));
const Demografico = lazy(() => import("./pages/Demografico"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const F = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<F><Login /></F>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/admin" element={<AdminRoute><F><AdminPanel /></F></AdminRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<F><ConsolidadoCM /></F>} />
              <Route path="financeiro" element={<FinanceiroRoute><F><Financeiro /></F></FinanceiroRoute>} />
              <Route path="ga4" element={<F><GA4 /></F>} />

              <Route path="meta-ads" element={<F><MetaAds /></F>} />
              <Route path="google-ads" element={<F><GoogleAds /></F>} />
              <Route path="tiktok" element={<F><TikTok /></F>} />
              <Route path="investimento" element={<F><Investimento /></F>} />
              <Route path="consolidado-pr" element={<F><ConsolidadoPR /></F>} />
              <Route path="auditoria" element={<F><Auditoria /></F>} />
              
              <Route path="analista-ia" element={<F><AnalistaIA /></F>} />
              <Route path="metas-pv" element={<F><MetasPV /></F>} />
              <Route path="passaporte-cm" element={<F><PassaporteCM /></F>} />
              <Route path="sunset-boat-sexta" element={<F><SunsetBoatSexta /></F>} />
              <Route path="sunset-boat-sabado" element={<F><SunsetBoatSabado /></F>} />
              <Route path="demografico" element={<F><Demografico /></F>} />
            </Route>
            <Route path="*" element={<F><NotFound /></F>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
