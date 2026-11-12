import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { mergeEmployeeDirectory, type EmployeeDirectoryRecord } from "../utils/employeeDirectory";

export const EMPLOYEE_COLLECTIONS = [
  "employees",
  "funcionarios",
  "staff",
  "admins",
  "user_profiles",
  "pending_users",
] as const;

type EmployeeCollection = typeof EMPLOYEE_COLLECTIONS[number];

export function useEmployeeDirectory() {
  const [records, setRecords] = useState<EmployeeDirectoryRecord[]>([]);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const employees = useMemo(() => mergeEmployeeDirectory(records), [records]);

  useEffect(() => {
    const stops = EMPLOYEE_COLLECTIONS.map((source) => onSnapshot(
      collection(db, source),
      (snapshot) => {
        const loaded = snapshot.docs.map((item) => ({
          id: item.id,
          source,
          data: item.data(),
        }) as EmployeeDirectoryRecord);
        setRecords((current) => [...current.filter((record) => record.source !== source), ...loaded]);
      },
      (reason) => setError((current) => [current, `Falha ao carregar ${source}: ${reason.message}`].filter(Boolean).join(" · ")),
    ));
    return () => stops.forEach((stop) => stop());
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError("");
    const results = await Promise.allSettled(EMPLOYEE_COLLECTIONS.map(async (source) => {
      const snapshot = await getDocs(collection(db, source));
      return {
        source,
        records: snapshot.docs.map((item) => ({
          id: item.id,
          source,
          data: item.data(),
        }) as EmployeeDirectoryRecord),
      };
    }));
    const successfulSources: EmployeeCollection[] = [];
    const failures: string[] = [];
    const loaded: EmployeeDirectoryRecord[] = [];
    results.forEach((result, index) => {
      const source = EMPLOYEE_COLLECTIONS[index];
      if (result.status === "fulfilled") {
        successfulSources.push(source);
        loaded.push(...result.value.records);
      } else {
        failures.push(`${source}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    });
    setRecords((current) => [
      ...current.filter((record) => !successfulSources.includes(record.source)),
      ...loaded,
    ]);
    setError(failures.length ? `Falha ao sincronizar cadastros — ${failures.join(" · ")}` : "");
    setSyncing(false);
  }, []);

  return { employees, error, syncing, sync };
}
