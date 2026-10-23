import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, setDoc, query, orderBy } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Shield, CheckCircle, XCircle, Mail, Clock, Trash2, Plus, UserCog } from "lucide-react";
import { Role, ROLES, SUPER_ADMIN_EMAIL, getAssignableRoles, getRoleConfig } from "../../utils/roles";

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
  role: Role;
  addedBy?: string;
  addedAt?: string;
}

export default function AdminModule({ currentRole }: { currentRole: Role }) {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"pending" | "admins">("pending");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<Role>("colaborador");
  const [loading, setLoading] = useState(true);

  const assignableRoles = getAssignableRoles(currentRole);

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
      list.sort((a, b) => (ROLES[b.role]?.level || 0) - (ROLES[a.role]?.level || 0));
      setAdmins(list);
    }, (err) => console.warn("Admins listener:", err));

    return () => { u1(); u2(); };
  }, []);

  const saveAdmin = async (email: string, role: Role, removeFromPending?: string) => {
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

  const approveUser = async (user: PendingUser, role: Role) => {
    try {
      await saveAdmin(user.email, role, user.id);
    } catch (e) {
      console.error(e);
      alert("Error al aprobar usuario: " + (e as Error).message);
    }
  };

  const rejectUser = async (user: PendingUser) => {
    if (!confirm(`¿Rechazar la solicitud de ${user.email}?`)) return;
    try {
      await deleteDoc(doc(db, "pending_users", user.id));
    } catch (e) {
      console.error(e);
      alert("Error al rechazar: " + (e as Error).message);
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert("No puedes eliminar al super administrador.");
      return;
    }
    const config = getRoleConfig(admin.role);
    const currentLevel = getRoleConfig(currentRole).level;
    if (config.level >= currentLevel) {
      alert(`No puedes eliminar a un usuario con rol igual o superior al tuyo (${config.label}).`);
      return;
    }
    if (!confirm(`¿Quitar permisos de ${config.label} a ${admin.email}?`)) return;
    try {
      await deleteDoc(doc(db, "admins", admin.id));
    } catch (e) {
      console.error(e);
      alert("Error al eliminar admin: " + (e as Error).message);
    }
  };

  const changeRole = async (admin: AdminUser, newRole: Role) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert("No puedes cambiar el rol del super administrador.");
      return;
    }
    if (!assignableRoles.some((r) => r.id === newRole)) {
      alert("No tienes permiso para asignar ese rol.");
      return;
    }
    try {
      await saveAdmin(admin.email, newRole);
      alert(`✅ ${admin.email} ahora es ${ROLES[newRole].label}.`);
    } catch (e) {
      console.error(e);
      alert("Error al cambiar rol: " + (e as Error).message);
    }
  };

  const addAdminManually = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return alert("Email inválido");
    if (!assignableRoles.some((r) => r.id === newAdminRole)) {
      return alert("No tienes permiso para asignar ese rol.");
    }
    try {
      const pendingEntry = pending.find((p) => p.email.toLowerCase() === email);
      await saveAdmin(email, newAdminRole, pendingEntry?.id);
      setNewAdminEmail("");
      alert(`✅ ${email} ahora es ${ROLES[newAdminRole].label}.`);
    } catch (e) {
      console.error(e);
      alert("Error al añadir admin: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" /> Administración de Usuarios y Roles
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tu rol actual:{" "}
          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-black ${getRoleConfig(currentRole).color}`}>
            {getRoleConfig(currentRole).label}
          </span>
          {" "}— {getRoleConfig(currentRole).description}
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
          <Clock className="w-4 h-4" /> Pendientes
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
              <h3 className="font-bold text-slate-700 dark:text-slate-200">Sin solicitudes pendientes</h3>
              <p className="text-sm text-slate-500 mt-1">Los usuarios que intenten acceder sin permiso aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {pending.map((u) => (
                <PendingRow
                  key={u.id}
                  user={u}
                  assignableRoles={assignableRoles}
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
            <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Añadir usuario manualmente</h3>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="flex-1 min-w-[200px] p-2 border rounded text-sm bg-white dark:bg-slate-800"
              />
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value as Role)}
                className="p-2 border rounded text-sm bg-white dark:bg-slate-800"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <button onClick={addAdminManually} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
                Añadir
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Puedes asignar: {assignableRoles.map((r) => r.label).join(", ") || "ninguno"}.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Añadido por</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const isSuper = a.email === SUPER_ADMIN_EMAIL;
                  const canEdit = !isSuper && assignableRoles.some((r) => r.id === a.role);
                  return (
                    <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 font-mono text-xs">
                        {a.email}
                        {isSuper && (
                          <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded">SUPER</span>
                        )}
                      </td>
                      <td className="p-3">
                        {canEdit ? (
                          <select
                            value={a.role}
                            onChange={(e) => changeRole(a, e.target.value as Role)}
                            className="p-1 border rounded text-xs bg-white dark:bg-slate-800"
                          >
                            {assignableRoles.map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${getRoleConfig(a.role).color}`}>
                            {getRoleConfig(a.role).label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{a.addedBy || "-"}</td>
                      <td className="p-3 text-xs text-slate-500">{a.addedAt ? new Date(a.addedAt).toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="p-3">
                        {!isSuper && canEdit && (
                          <button onClick={() => removeAdmin(a)} className="p-1 text-rose-600 hover:text-rose-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}

function PendingRow({
  user,
  assignableRoles,
  onApprove,
  onReject,
}: {
  user: PendingUser;
  assignableRoles: { id: Role; label: string }[];
  onApprove: (user: PendingUser, role: Role) => void;
  onReject: (user: PendingUser) => void;
}) {
  const [role, setRole] = useState<Role>(assignableRoles[0]?.id || "usuario");

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
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-2 py-1.5 text-xs border rounded bg-white dark:bg-slate-800"
        >
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={() => onApprove(user, role)}
          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Aprobar
        </button>
        <button
          onClick={() => onReject(user)}
          className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100"
        >
          <XCircle className="w-3.5 h-3.5" /> Rechazar
        </button>
      </div>
    </div>
  );
}
