import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { Clock, LogOut, ShieldCheck, Mail } from "lucide-react";

interface Props {
  userEmail?: string;
}

export default function PendingApproval({ userEmail }: Props) {
  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Aguardando Aprovação
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Sua conta foi autenticada, mas ainda não tem permissão para acessar o painel administrativo.
          Solicite aprovação ao super administrador.
        </p>
        {userEmail && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mb-6 flex items-center gap-2 text-xs">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="font-mono text-slate-700 dark:text-slate-300">{userEmail}</span>
          </div>
        )}
        <div className="space-y-2 text-xs text-left bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-800 dark:text-blue-300">
              O super administrador precisa adicionar seu email à coleção <strong>admins</strong> no Firebase.
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:opacity-90 transition"
        >
          <LogOut className="w-4 h-4" /> Sair e tentar outro email
        </button>
      </div>
    </div>
  );
}
