import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, RefreshCw, Plus, LogOut, Users, MessageCircle,
  Loader2, UserPlus, Trash2, KeyRound, ArrowLeft, Phone, X, ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
interface Client {
  id: string; name: string; slug: string; bq_project: string;
  dataset: string; is_active: boolean; created_at: string; updated_at: string;
}
interface UserRow {
  id: string; email: string; full_name: string; is_active: boolean;
  role: string; created_at: string; last_login: string | null; client_id: string | null;
}
interface WhatsAppNumber {
  id: string; client_id: string; phone_number: string; label: string; created_at: string;
}

function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function AdminPanel() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", slug: "", bq_project: "", dataset: "", is_active: true });
  const [slugManual, setSlugManual] = useState(false);

  // Users modal
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [clientUsers, setClientUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", full_name: "", password: "", role: "client" });

  // WhatsApp modal
  const [whatsappClient, setWhatsappClient] = useState<Client | null>(null);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  // ─── Fetch clients ───
  const fetchClients = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setClients((data as any[]) || []);
    } catch (err: any) {
      toast.error("Erro ao carregar clientes: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // ─── Create client ───
  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.slug) { toast.error("Nome e slug são obrigatórios"); return; }
    setSavingClient(true);
    try {
      const { error } = await supabase.from("clients").insert({
        name: newClient.name, slug: newClient.slug,
        bq_project: newClient.bq_project, dataset: newClient.dataset, is_active: newClient.is_active,
      } as any);
      if (error) throw error;
      toast.success("Cliente criado");
      setClientModalOpen(false);
      setNewClient({ name: "", slug: "", bq_project: "", dataset: "", is_active: true });
      setSlugManual(false);
      fetchClients();
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setSavingClient(false); }
  };

  // ─── Delete client ───
  const handleDeleteClient = async (id: string) => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== id));
      toast.success("Cliente deletado");
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  // ─── Toggle client status ───
  const handleToggleClient = async (c: Client) => {
    try {
      const { error } = await supabase.from("clients")
        .update({ is_active: !c.is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", c.id);
      if (error) throw error;
      setClients(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  // ─── Users modal ───
  const openUsersModal = async (client: Client) => {
    setSelectedClient(client);
    setUsersModalOpen(true);
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "list_users", client_id: client.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientUsers(data.data || []);
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setLoadingUsers(false); }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) { toast.error("Email e senha obrigatórios"); return; }
    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "create_user", ...newUser, client_id: selectedClient?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado");
      setCreateUserOpen(false);
      setNewUser({ email: "", full_name: "", password: "", role: "client" });
      if (selectedClient) openUsersModal(selectedClient);
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setCreatingUser(false); }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "reset_password", email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Link de reset enviado");
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "delete_user", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário removido");
      setClientUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "update_role", user_id: userId, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      toast.success("Role atualizada");
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  // ─── WhatsApp modal ───
  const openWhatsappModal = async (client: Client) => {
    setWhatsappClient(client);
    setWhatsappModalOpen(true);
    setLoadingWhatsapp(true);
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "list_whatsapp", client_id: client.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWhatsappNumbers(data.data || []);
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setLoadingWhatsapp(false); }
  };

  const handleAddWhatsapp = async () => {
    if (!newPhone) { toast.error("Informe o número"); return; }
    setAddingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "add_whatsapp", client_id: whatsappClient?.id, phone_number: newPhone, label: newPhoneLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWhatsappNumbers(prev => [...prev, data.data]);
      setNewPhone("");
      setNewPhoneLabel("");
      toast.success("Número adicionado");
    } catch (err: any) { toast.error("Erro: " + err.message); }
    finally { setAddingPhone(false); }
  };

  const handleRemoveWhatsapp = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "admin-users", {
        body: { action: "remove_whatsapp", id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWhatsappNumbers(prev => prev.filter(w => w.id !== id));
      toast.success("Número removido");
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00B8D9]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* ─── Header ─── */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#00B8D9]" />
            <div>
              <h1 className="text-xl font-bold">Painel Admin</h1>
              <p className="text-sm text-gray-400">Gestão de clientes e usuários</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 gap-2"
              onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Button>
            <Button variant="outline" size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 gap-2"
              onClick={() => { setLoading(true); fetchClients(); }}>
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            <Button size="sm" className="bg-[#00B8D9] hover:bg-[#00A3C4] text-white gap-2"
              onClick={() => setClientModalOpen(true)}>
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
            <Button variant="ghost" size="icon"
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={handleLogout} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Clients Table ─── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">Clientes</h2>
            <p className="text-sm text-gray-400">{clients.length} clientes cadastrados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  {["NOME", "SLUG", "BQ PROJECT", "DATASET", "STATUS", "AÇÕES"].map(h => (
                    <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider ${h === "AÇÕES" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500">Nenhum cliente cadastrado.</td></tr>
                ) : clients.map(c => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-gray-300 font-mono text-xs">{c.slug}</td>
                    <td className="px-6 py-4 text-gray-300 text-xs">{c.bq_project || "—"}</td>
                    <td className="px-6 py-4 text-gray-300 text-xs">{c.dataset || "—"}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline"
                        className={`cursor-pointer text-xs font-medium ${c.is_active
                          ? "bg-[#00B8D9]/20 text-[#00B8D9] border-[#00B8D9]/30 hover:bg-[#00B8D9]/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"}`}
                        onClick={() => handleToggleClient(c)}>
                        {c.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-[#00B8D9] hover:bg-white/10"
                          title="Gerenciar Usuários" onClick={() => openUsersModal(c)}>
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-white/10"
                          title="WhatsApp" onClick={() => openWhatsappModal(c)}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-white/10" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#1E293B] border-white/10 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar Cliente</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                Tem certeza que deseja deletar <strong className="text-white">{c.name}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteClient(c.id)} className="bg-red-600 text-white hover:bg-red-700">Deletar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ─── New Client Modal ─── */}
      <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription className="text-gray-400">Preencha os dados do novo cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome *</Label>
              <Input placeholder="Ex: Coral Moment"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                value={newClient.name}
                onChange={e => { const n = e.target.value; setNewClient(p => ({ ...p, name: n, ...(slugManual ? {} : { slug: toSlug(n) }) })); }} />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Slug</Label>
              <Input className="bg-white/5 border-white/10 text-white font-mono text-xs"
                value={newClient.slug}
                onChange={e => { setSlugManual(true); setNewClient(p => ({ ...p, slug: e.target.value })); }} />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">BQ Project ID</Label>
              <Input placeholder="projeto-bq-123"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                value={newClient.bq_project}
                onChange={e => setNewClient(p => ({ ...p, bq_project: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Dataset</Label>
              <Input placeholder="Silver"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                value={newClient.dataset}
                onChange={e => setNewClient(p => ({ ...p, dataset: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white bg-transparent hover:bg-white/10"
              onClick={() => setClientModalOpen(false)}>Cancelar</Button>
            <Button className="bg-[#00B8D9] hover:bg-[#00A3C4] text-white" onClick={handleCreateClient} disabled={savingClient}>
              {savingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Users Modal ─── */}
      <Dialog open={usersModalOpen} onOpenChange={setUsersModalOpen}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00B8D9]" />
              Usuários — {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Add user form toggle */}
          {!createUserOpen ? (
            <Button size="sm" className="bg-[#00B8D9] hover:bg-[#00A3C4] text-white gap-2 w-fit"
              onClick={() => setCreateUserOpen(true)}>
              <UserPlus className="w-4 h-4" /> Adicionar Usuário
            </Button>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Novo Usuário</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-white"
                  onClick={() => setCreateUserOpen(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Nome</Label>
                  <Input placeholder="Nome completo" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-9 text-sm"
                    value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Email *</Label>
                  <Input placeholder="email@exemplo.com" type="email"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-9 text-sm"
                    value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Senha temporária *</Label>
                  <div className="flex gap-1">
                    <Input placeholder="Min. 6 caracteres" type="text"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-9 text-sm flex-1"
                      value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
                      title="Copiar senha" onClick={() => { navigator.clipboard.writeText(newUser.password); toast.success("Senha copiada!"); }}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Role</Label>
                  <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E293B] border-white/10 text-white">
                      <SelectItem value="client">Viewer</SelectItem>
                      <SelectItem value="admin">Admin do Projeto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" className="bg-[#00B8D9] hover:bg-[#00A3C4] text-white" onClick={handleCreateUser} disabled={creatingUser}>
                {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Usuário"}
              </Button>
            </div>
          )}

          {/* Users table */}
          {loadingUsers ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#00B8D9]" /></div>
          ) : clientUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Nenhum usuário vinculado.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Nome</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Role</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clientUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <Select value={u.role === "admin" ? "admin" : "client"}
                          onValueChange={v => handleUpdateRole(u.id, v)}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1E293B] border-white/10 text-white">
                            <SelectItem value="client">Viewer</SelectItem>
                            <SelectItem value="admin">Admin do Projeto</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-yellow-400 hover:bg-white/10"
                            title="Resetar senha" onClick={() => handleResetPassword(u.email)}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-white/10" title="Remover">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#1E293B] border-white/10 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Remover <strong className="text-white">{u.email}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-red-600 text-white hover:bg-red-700">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── WhatsApp Modal ─── */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Números WhatsApp — {whatsappClient?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Add number */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input placeholder="+55 81 99999-9999"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-9 text-sm"
                value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Input placeholder="Ex: Grupo Marketing"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-9 text-sm"
                value={newPhoneLabel} onChange={e => setNewPhoneLabel(e.target.value)} />
            </div>
            <Button size="sm" className="bg-[#00B8D9] hover:bg-[#00A3C4] text-white h-9 gap-1"
              onClick={handleAddWhatsapp} disabled={addingPhone}>
              {addingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Adicionar</>}
            </Button>
          </div>

          {/* List */}
          {loadingWhatsapp ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#00B8D9]" /></div>
          ) : whatsappNumbers.length === 0 ? (
            <p className="text-center text-gray-500 py-4">Nenhum número cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {whatsappNumbers.map(w => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{w.phone_number}</p>
                      {w.label && <p className="text-xs text-gray-400">{w.label}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-white/10"
                    onClick={() => handleRemoveWhatsapp(w.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPanel;
