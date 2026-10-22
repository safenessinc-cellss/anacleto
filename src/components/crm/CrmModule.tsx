import React, { useState } from "react";
import {
  Building,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  User,
  Trash,
  Edit2,
  FileText,
  Save,
  X,
  Briefcase
} from "lucide-react";
import { Company } from "../../types";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../ToastContext";

interface CrmModuleProps {
  companies: Company[];
  onSelectCompanyForQuote?: (company: Company) => void;
}

export default function CrmModule({ companies, onSelectCompanyForQuote }: CrmModuleProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingCompany(null);
    setName("");
    setTaxId("");
    setEmail("");
    setPhone("");
    setAddress("");
    setContactPerson("");
    setNotes("");
    setIsModalOpen(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setName(comp.name);
    setTaxId(comp.taxId);
    setEmail(comp.email);
    setPhone(comp.phone);
    setAddress(comp.address);
    setContactPerson(comp.contactPerson || "");
    setNotes(comp.notes || "");
    setIsModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !taxId.trim()) {
      showToast("Nombre y NIF/CIF son obligatorios.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const companyId = editingCompany?.id || "comp_" + Math.random().toString(36).substring(2, 9);
      const companyData: Company = {
        id: companyId,
        name: name.trim(),
        taxId: taxId.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        contactPerson: contactPerson.trim(),
        notes: notes.trim(),
        createdAt: editingCompany?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "companies", companyId), companyData);
      showToast(`Empresa "${name}" guardada con éxito.`, "success");
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Error al guardar empresa.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompany = async (id: string, compName: string) => {
    if (!confirm(`¿Eliminar la empresa "${compName}" del CRM?`)) return;
    try {
      await deleteDoc(doc(db, "companies", id));
      showToast("Empresa eliminada.", "info");
    } catch (err) {
      console.error(err);
      showToast("No se pudo eliminar la empresa.", "error");
    }
  };

  const filtered = companies.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                CRM Corporativo
              </span>
              <span className="text-[10px] font-mono text-slate-400">Total: {companies.length} Empresas</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
              Directorio de Empresas & Clientes
            </h1>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Registrar Empresa
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar empresa por nombre, NIF o contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Grid of Companies */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
          <Building className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No hay empresas registradas en el CRM</h3>
          <p className="text-xs text-slate-400 mt-1">Registra la primera empresa cliente para vincularla a tus presupuestos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-3xl shadow-xl flex flex-col justify-between transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{comp.name}</h3>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">NIF/CIF: {comp.taxId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(comp)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(comp.id, comp.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  {comp.contactPerson && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{comp.contactPerson}</span>
                    </div>
                  )}
                  {comp.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{comp.email}</span>
                    </div>
                  )}
                  {comp.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{comp.phone}</span>
                    </div>
                  )}
                  {comp.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{comp.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {onSelectCompanyForQuote && (
                <div className="pt-4 mt-4 border-t border-slate-800">
                  <button
                    onClick={() => onSelectCompanyForQuote(comp)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-950 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-800 hover:border-indigo-500"
                  >
                    <FileText className="w-3.5 h-3.5" /> Crear Presupuesto
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit Company */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCompany ? "Editar Empresa" : "Registrar Nueva Empresa"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Razón Social / Nombre *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Constructora San Juan S.L."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">NIF / CIF / CNPJ *</label>
                  <input
                    type="text"
                    required
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Ej: B-12345678"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@empresa.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Director de Obra, Arquitecto, Administrador..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dirección Fiscal / Sede</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, Número, Ciudad, CP"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notas Comerciales</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Condiciones de pago, tipo de proyectos..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-md"
                >
                  {isSubmitting ? "Guardando..." : "Guardar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
