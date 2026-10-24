import React, { useState } from "react";
import {
  Settings,
  Save,
  Building,
  CreditCard,
  Mail,
  Phone,
  Globe,
  MapPin,
  CheckCircle,
  ShieldCheck
} from "lucide-react";
import { SenderConfig } from "../../types";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../ToastContext";

interface SettingsModuleProps {
  senderConfig: SenderConfig;
  setSenderConfig: React.Dispatch<React.SetStateAction<SenderConfig>>;
  language?: string;
}

export default function SettingsModule({ senderConfig, setSenderConfig, language = "pt"}: SettingsModuleProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<SenderConfig>(senderConfig);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof SenderConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "sender_config", "default"), updated);
      setSenderConfig(updated);
      showToast("Configuración fiscal y corporativa guardada.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar configuración.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shadow-lg">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Ajustes del Sistema
              </span>
              <span className="text-[10px] font-mono text-slate-400">Anacleto Pro v2.6</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Datos Fiscales de Empresa & Emisión
            </h1>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Building className="w-4 h-4" /> Datos de Identificación Fiscal (Aparecen en PDFs)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1 font-bold">Razão Social de la Empresa *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-bold">CNPJ / CIF / CNPJ *</label>
              <input
                type="text"
                required
                value={formData.nif}
                onChange={(e) => handleChange("nif", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">Domicilio Fiscal / Endereço</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Código Postal</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Ciudad y País</label>
              <input
                type="text"
                value={`${formData.city} - ${formData.country}`}
                onChange={(e) => {
                  const parts = e.target.value.split("-");
                  handleChange("city", parts[0]?.trim() || "");
                  handleChange("country", parts[1]?.trim() || "");
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Datos Bancarios y Moeda
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1 font-bold">Cuenta Bancaria para Transferencias (IBAN / PIX)</label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => handleChange("bankAccount", e.target.value)}
                placeholder="ES00 0000 0000 0000 0000 0000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Moeda Principal</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              >
                <option value="BRL">EUR (R$) - Euro</option>
                <option value="BRL">BRL (R$) - Real Brasileño</option>
                <option value="USD">USD ($) - Dólar Estadounidense</option>
                <option value="MXN">MXN ($) - Peso Mexicano</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Email de Facturación</label>
              <input
                type="email"
                value={formData.profileEmail || ""}
                onChange={(e) => handleChange("profileEmail", e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>
      </form>
    </div>
  );
}
