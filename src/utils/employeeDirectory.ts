export interface EmployeeDirectoryRecord {
  id: string;
  source: "employees" | "funcionarios" | "admins" | "pending_users" | "user_profiles" | "staff";
  data: Record<string, unknown>;
}

export interface EmployeeDirectoryEntry {
  id: string;
  aliases: string[];
  records: EmployeeDirectoryRecord[];
  uid?: string;
  name: string;
  email?: string;
  role?: string;
  salary: number;
  active: boolean;
  cpf?: string;
  department?: string;
  phone?: string;
  pixKey?: string;
  admissionDate?: string;
  monthlyHours?: number;
  additions?: { name: string; kind: "fixed" | "percent"; value: number }[];
  source: EmployeeDirectoryRecord["source"];
}

function firstString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const sourcePriority: Record<EmployeeDirectoryRecord["source"], number> = {
  employees: 6,
  funcionarios: 6,
  staff: 5,
  admins: 4,
  user_profiles: 3,
  pending_users: 2,
};

function toEntry(record: EmployeeDirectoryRecord): EmployeeDirectoryEntry | null {
  const { data } = record;
  if (data.deleted === true) return null;
  const name = firstString(data, ["name", "displayName", "fullName", "requestedName", "nome"]);
  const email = firstString(data, ["email", "workEmail", "userEmail"]).toLowerCase();
  const uid = firstString(data, ["uid", "userId", "authUid"]) || (record.source === "user_profiles" ? record.id : "");
  const salaryValue = Number(data.salary ?? data.baseSalary ?? data.salaryBase ?? 0);
  return {
    id: record.source === "employees" || record.source === "funcionarios" || record.source === "staff" ? record.id : uid || email || record.id,
    aliases: [...new Set([record.id, uid, email].filter(Boolean))],
    records: [record],
    uid: uid || undefined,
    name: name || email.split("@")[0] || record.id,
    email: email || undefined,
    role: firstString(data, ["role", "position", "cargo", "jobTitle", "type"]),
    salary: Number.isFinite(salaryValue) && salaryValue > 0 ? salaryValue : 0,
    active: data.active !== false && data.isActive !== false && !/inactive|inativo|desativad/i.test(String(data.status || "")),
    cpf: firstString(data, ["cpf", "document"]),
    department: firstString(data, ["department", "sector", "departamento"]),
    phone: firstString(data, ["phone", "telephone", "telefone"]),
    pixKey: firstString(data, ["pixKey", "chavePix", "pix_key", "pix"]),
    admissionDate: firstString(data, ["admissionDate", "hireDate", "dataAdmissao"]),
    monthlyHours: Number(data.monthlyHours || data.hoursPerMonth || 0) || undefined,
    additions: Array.isArray(data.additions) ? data.additions as EmployeeDirectoryEntry["additions"] : [],
    source: record.source,
  };
}

export function mergeEmployeeDirectory(records: EmployeeDirectoryRecord[]): EmployeeDirectoryEntry[] {
  const entries: Array<{ entry: EmployeeDirectoryEntry; priority: number; mergedInto?: { entry: EmployeeDirectoryEntry; priority: number } }> = [];
  const aliases = new Map<string, (typeof entries)[number]>();
  for (const record of records) {
    const entry = toEntry(record);
    if (!entry) continue;
    const keys = [
      `id:${record.id}`,
      entry.email ? `email:${entry.email}` : "",
      entry.uid ? `uid:${entry.uid}` : "",
    ].filter(Boolean);
    const matchingEntries = [...new Set(keys.map((key) => aliases.get(key)).filter((item): item is (typeof entries)[number] => item !== undefined))];
    if (!matchingEntries.length) {
      const newEntry = { entry, priority: sourcePriority[record.source] };
      entries.push(newEntry);
      for (const key of keys) aliases.set(key, newEntry);
      continue;
    }

    const resolve = (candidate: (typeof entries)[number]) => {
      let current = candidate;
      while (current.mergedInto) current = current.mergedInto;
      return current;
    };
    const existing = matchingEntries.map(resolve).sort((a, b) => b.priority - a.priority)[0];
    for (const duplicate of matchingEntries.map(resolve)) {
      if (duplicate === existing) continue;
      if (duplicate.priority > existing.priority) {
        existing.entry = {
          ...existing.entry,
          ...duplicate.entry,
          aliases: [...new Set([...existing.entry.aliases, ...duplicate.entry.aliases])],
          records: [...existing.entry.records, ...duplicate.entry.records],
        };
        existing.priority = duplicate.priority;
      }
      duplicate.mergedInto = existing;
    }
    const nextPriority = sourcePriority[record.source];
    if (nextPriority > existing.priority) {
      existing.entry = {
        ...existing.entry,
        ...entry,
        aliases: [...new Set([...existing.entry.aliases, ...entry.aliases])],
        records: [...existing.entry.records, ...entry.records],
      };
      existing.priority = nextPriority;
    } else {
      existing.entry = {
        ...entry,
        ...existing.entry,
        aliases: [...new Set([...existing.entry.aliases, ...entry.aliases])],
        records: [...existing.entry.records, ...entry.records],
        name: existing.entry.name || entry.name,
        email: existing.entry.email || entry.email,
        uid: existing.entry.uid || entry.uid,
        salary: existing.entry.salary || entry.salary,
        role: existing.entry.role || entry.role,
        cpf: existing.entry.cpf || entry.cpf,
        department: existing.entry.department || entry.department,
        phone: existing.entry.phone || entry.phone,
        pixKey: existing.entry.pixKey || entry.pixKey,
        admissionDate: existing.entry.admissionDate || entry.admissionDate,
        monthlyHours: existing.entry.monthlyHours || entry.monthlyHours,
        additions: existing.entry.additions?.length ? existing.entry.additions : entry.additions,
      };
    }
    for (const key of keys) aliases.set(key, existing);
  }
  return entries.filter((item) => !item.mergedInto).map(({ entry }) => entry)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
