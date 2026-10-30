import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, setDoc, query, orderBy } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { CheckCircle, Clock, Mail, Plus, Shield, Trash2, User, UserCog, X, XCircle, SlidersHorizontal } from "lucide-react";
import { Perfile, ROLES, SUPER_ADMIN_EMAIL, getAssignablePerfiles, getPerfileConfig } from "../../utils/roles";

interface PendingUser {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  uid: string;
  requestedAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  role: Perfile;
  permissions?: string[];
  addedBy?: string;
  addedAt?: string;
}

export default function AdminModule({ currentPerfile }: { currentPerfile: Perfile }) {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"pending" | "admins">("pending");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPerfile, setNewAdminPerfile] = useState<Perfile>("colaborador");
  const [loading, setLoading] = useState(true);
  const [permissionUser, setPermissionUser] = useState<AdminUser | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const permissionModules = [{id:"dashboard",label:"Início"},{id:"crm",label:"Clientes / CRM"},{id:"quotes",label:"Orçamentos"},{id:"invoices",label:"Faturas"},{id:"technical_drawing",label:"Desenho técnico"},{id:"agenda",label:"Agenda"},{id:"catalog",label:"Catálogo / Itens"},{id:"finance",label:"Financeiro"},{id:"financial_ai",label:"IA financeira"},{id:"payroll",label:"Folha de pagamento"},{id:"reports",label:"Relatórios"},{id:"tipologias",label:"Tipologias"},{id:"projects",label:"Projetos"},{id:"settings",label:"Configurações"},{id:"theme",label:"Aparência"},{id:"suggestions",label:"Sugestões"}];

  const assignablePerfiles = getAssignablePerfiles(currentPerfile);

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, "pending_users"), orderBy("requestedAt", "desc")),
      (snap) => {
        const list: PendingUser[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PendingUser));
        setPending(list);
        setLoading(false);
      },
      (err) => { console.warn("Pending listener:", err); setLoading(false); }
    );

    const u2 = onSnapshot(collection(db, "admins"), (snap) => {
      const list: AdminUser[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AdminUser));
      // Excluir al super admin de la lista (se detecta por email)
      const filtered = list.filter((a) => a.email !== SUPER_ADMIN_EMAIL);
      filtered.sort((a, b) => (ROLES[b.role]?.level || 0) - (ROLES[a.role]?.level || 0));
      setAdmins(filtered);
    }, (err) => console.warn("Admins listener:", err));

    return () => { u1(); u2(); };
  }, []);

  const saveAdmin = async (email: string, role: Perfile, removeFromPending?: string) => {
    await setDoc(doc(db, "admins", email.toLowerCase()), {
      email: email.toLowerCase(),
      role,
      addedBy: auth.currentUser?.email || "",
      addedAt: new Date().toISOString(),
    }, { merge: true });
    if (removeFromPending) {
      await deleteDoc(doc(db, "pending_users", removeFromPending));
    }
  };

  const approveUser = async (user: PendingUser, role: Perfile) => {
    try {
      await saveAdmin(user.email, role, user.id);
    } catch (e) {
      console.error(e);
      alert("Erro ao aprovar usuário: " + (e as Error).message);
    }
  };

  const rejectUser = async (user: PendingUser) => {
    if (!confirm(`Rejeitar a solicitação de ${user.email}?`)) return;
    try {
      await deleteDoc(doc(db, "pending_users", user.id));
    } catch (e) {
      console.error(e);
      alert("Erro ao rejeitar: " + (e as Error).message);
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert("Não é possível excluir o superadministrador.");
      return;
    }
    const config = getPerfileConfig(admin.role);
    const currentLevel = getPerfileConfig(currentPerfile).level;
    if (config.level >= currentLevel) {
      alert(`Não é possível excluir um usuário com perfil igual ou superior ao seu (${config.label}).`);
      return;
    }
    if (!confirm(`Remover as permissões de ${config.label} a ${admin.email}?`)) return;
    try {
      await deleteDoc(doc(db, "admins", admin.id));
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir administrador: " + (e as Error).message);
    }
  };

  const openPermissions = (admin: AdminUser) => { setPermissionUser(admin); setPermissionDraft(admin.permissions || ROLES[admin.role].tabs); };
  const savePermissions = async () => { if (!permissionUser || permissionUser.email === SUPER_ADMIN_EMAIL) return; try { await setDoc(doc(db, "admins", permissionUser.id), { permissions: permissionDraft, permissionsUpdatedBy: auth.currentUser?.email || "", permissionsUpdatedAt: new Date().toISOString() }, { merge: true }); setPermissionUser(null); alert("Permissões atualizadas."); } catch (e) { alert("Erro ao salvar permissões: " + (e as Error).message); } };

  const changePerfile = async (admin: AdminUser, newPerfile: Perfile) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert("Não é possível alterar o perfil do superadministrador.");
      return;
    }
    if (!assignablePerfiles.some((r) => r.id === newPerfile)) {
      alert("Você não tem permissão para atribuir esse perfil.");
      return;
    }
    try {
      await saveAdmin(admin.email, newPerfile);
      alert(`✅ ${admin.email} agora é ${ROLES[newPerfile].label}.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao alterar o perfil: " + (e as Error).message);
    }
  };

  const addAdminManually = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return alert("E-mail inválido");
    if (!assignablePerfiles.some((r) => r.id === newAdminPerfile)) {
      return alert("Você não tem permissão para atribuir esse perfil.");
    }
    try {
      const pendingEntry = pending.find((p) => p.email.toLowerCase() === email);
      await saveAdmin(email, newAdminPerfile, pendingEntry?.id);
      setNewAdminEmail("");
      alert(`✅ ${email} agora é ${ROLES[newAdminPerfile].label}.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar administrador: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" /> Administração de usuários e perfis
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Seu perfil atual:{" "}
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-black ${getPerfileConfig(currentPerfile).color}`}>
            {getPerfileConfig(currentPerfile).label}
          </span>
          {" "}— {getPerfileConfig(currentPerfile).description}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            tab === "pending"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" /> Pendentes
          {pending.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black rounded-full px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("admins")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            tab === "admins"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCog className="w-4 h-4" /> Usuarios ({admins.length})
        </button>
      </div>

      {tab === "pending" && (
        <div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando...</div>
          ) : pending.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
              <h3 className="font-bold text-slate-700 dark:text-slate-200">Nenhuma solicitação pendente</h3>
              <p className="text-sm text-slate-500 mt-1">Os usuários que tentarem acessar sem permissão aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pending.map((u) => (
                <PendingRow
                  key={u.id}
                  user={u}
                  assignablePerfiles={assignablePerfiles}
                  onApprove={approveUser}
                  onReject={rejectUser}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "admins" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar usuário manualmente</h3>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 min-w-[200px] p-2 border rounded text-sm bg-white dark:bg-slate-800"
              />
              <select
                value={newAdminPerfile}
                onChange={(e) => setNewAdminPerfile(e.target.value as Perfile)}
                className="p-2 border rounded text-sm bg-white dark:bg-slate-800"
              >
                {assignablePerfiles.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <button onClick={addAdminManually} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
                Adicionar
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Você pode atribuir: {assignablePerfiles.map((r) => r.label).join(", ") || "nenhum"}.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Perfil</th>
                  <th className="p-3">Adicionado por</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* Superadministrador sempre visível */}
                <tr className="border-t border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-950/10">
                  <td className="p-3 font-mono text-xs">
                    {SUPER_ADMIN_EMAIL}
                    <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded">SUPER</span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded border text-xs font-bold bg-amber-100 text-amber-800 border-amber-300">
                      Super Admin
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-500">Sistema</td>
                  <td className="p-3 text-xs text-slate-500">-</td>
                  <td className="p-3 text-xs text-slate-400">Protegido</td>
                </tr>
                {admins.map((a) => {
                  const isSuper = a.email === SUPER_ADMIN_EMAIL;
                  const canEdit = !isSuper && assignablePerfiles.some((r) => r.id === a.role);
                  return (
                    <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 font-mono text-xs">
                        {a.email}
                        {isSuper && (
                          <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded">SUPER</span>
                        )}
                      </td>
                      <td className="p-3">
                        {a.email === SUPER_ADMIN_EMAIL ? (
                          <span className="inline-block px-2 py-0.5 rounded border text-xs font-bold bg-amber-100 text-amber-800 border-amber-300">
                            Super Admin
                          </span>
                        ) : canEdit ? (
                          <select
                            value={a.role}
                            onChange={(e) => changePerfile(a, e.target.value as Perfile)}
                            className="p-1 border rounded text-xs bg-white dark:bg-slate-800"
                          >
                            {assignablePerfiles.map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${getPerfileConfig(a.role).color}`}>
                            {getPerfileConfig(a.role).label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{a.addedBy || "-"}</td>
                      <td className="p-3 text-xs text-slate-500">{a.addedAt ? new Date(a.addedAt).toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="p-3">
                        {!isSuper && canEdit && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => openPermissions(a)} title="Atribuir módulos" className="p-2 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100">
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeAdmin(a)} title="Remover usuário" className="p-2 rounded-lg text-rose-600 hover:bg-rose-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isSuper && (
                          <span className="text-xs text-slate-400">Protegido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {admins.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum admin registrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {permissionUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border border-blue-100 shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div><h3 className="text-lg font-black text-slate-800">Permissões por módulo</h3><p className="text-sm text-slate-500">{permissionUser.email}</p></div>
              <button onClick={() => setPermissionUser(null)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Selecione os módulos que este usuário poderá visualizar no menu.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissionModules.map((m) => <label key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={permissionDraft.includes(m.id)} onChange={(e) => setPermissionDraft((prev) => e.target.checked ? [...prev,m.id] : prev.filter((id) => id !== m.id))} />
                {m.label}
              </label>)}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setPermissionUser(null)} className="px-4 py-2 rounded-xl border text-sm font-semibold text-slate-600">Cancelar</button>
              <button onClick={savePermissions} className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold">Salvar permissões</button>
            </div>
          </div>
        </div>
      )}
    </div>

    );
}

function PendingRow({
  user,
  assignablePerfiles,
  onApprove,
  onReject,
}: {
  user: PendingUser;
  assignablePerfiles: { id: Perfile; label: string }[];
  onApprove: (user: PendingUser, role: Perfile) => void;
  onReject: (user: PendingUser) => void;
}) {
  const [role, setPerfile] = useState<Perfile>(assignablePerfiles[0]?.id || "usuario");

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
        {user.photoURL ? (
          <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <Mail className="w-5 h-5 text-indigo-600" />
          </div>
        )}
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{user.displayName || "Sem nome"}</div>
          <div className="text-xs text-slate-500 font-mono">{user.email}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Solicitado em {new Date(user.requestedAt).toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={role}
          onChange={(e) => setPerfile(e.target.value as Perfile)}
          className="px-2 py-1.5 text-xs border rounded bg-white dark:bg-slate-800"
        >
          {assignablePerfiles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={() => onApprove(user, role)}
          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Aprovar
        </button>
        <button
          onClick={() => onReject(user)}
          className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100"
        >
          <XCircle className="w-3.5 h-3.5" /> Rejeitar
        </button>
      </div>
    </div>
  );
}
