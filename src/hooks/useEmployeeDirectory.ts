import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
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

  // Do not open collection listeners until Firebase has restored the signed-in
  // user. Starting these listeners during auth initialization can produce
  // permission-denied/400 listen failures that terminate the subscriptions.
  useEffect(() => {
    let active = true;
    let stops: Array<() => void> = [];

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stops.forEach((stop) => stop());
      stops = [];

      if (!active || !user) {
        setRecords([]);
        setError("");
        return;
      }

      setError("");
      stops = EMPLOYEE_COLLECTIONS.map((source) => onSnapshot(
        collection(db, source),
        (snapshot) => {
          if (!active) return;
          const loaded = snapshot.docs.map((item) => ({
            id: item.id,
            source,
            data: item.data(),
          }) as EmployeeDirectoryRecord);
          setRecords((current) => [
            ...current.filter((record) => record.source !== source),
            ...loaded,
          ]);
        },
        (reason) => {
          if (!active) return;
          setError((current) => [
            current,
            `Falha ao carregar ${source}: ${reason.message}`,
          ].filter(Boolean).join(" · "));
        },
      ));
    });

    return () => {
      active = false;
      stopAuth();
      stops.forEach((stop) => stop());
    };
  }, []);

  const sync = useCallback(async () => {
    if (!auth.currentUser) {
      setError("Sessão não autenticada. Entre novamente para sincronizar os funcionários.");
      return;
    }

    setSyncing(true);
    setError("");
    try {
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
    } finally {
      setSyncing(false);
    }
  }, []);

  return { employees, error, syncing, sync };
}
