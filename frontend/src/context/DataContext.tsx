import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getColleges, getMeta } from '../api';
import type { ApiCollege, Branch, BranchInfo, Category, College, Meta } from '../api/types';

/** Friendly short labels for the most common branch codes. */
const BRANCH_SHORT: Record<string, string> = {
  CSE: 'CSE', ECE: 'ECE', EEE: 'EEE', MEC: 'Mech', CIV: 'Civil', INF: 'IT',
  CSM: 'CSE-AIML', CSD: 'CSE-DS', CSC: 'CSE-CS', CSO: 'CSE-IoT', CSB: 'CSE-BS',
  CSI: 'CS-IT', CSN: 'CSE-Net', CSG: 'CS-Design', CSA: 'CSE-AI', CSW: 'CS-SE',
  CIC: 'CSE-IoT-CS', AIM: 'AI&ML', AID: 'AI&DS', AI: 'AI', ECM: 'ECM', ECI: 'ECI',
  EIE: 'EIE', AUT: 'Auto', ANE: 'Aero', CHE: 'Chemical', BIO: 'Biotech',
  BME: 'Biomedical', MET: 'Metallurgy', MIN: 'Mining', MCT: 'Mechatronics', CME: 'Computer',
};
const shortNameFor = (code: string): string => BRANCH_SHORT[code] ?? code;

export function rankKey(category: string, gender: string): string {
  return `${category}|${gender}`;
}
export function rankOf(branch: Branch, category: string, gender: string): number | null {
  const r = branch.ranks[rankKey(category, gender)];
  return typeof r === 'number' ? r : null;
}

function enrich(api: ApiCollege): College {
  return {
    ...api,
    id: api.code,
    region: api.university,
    branches: api.branches.map((b) => ({
      ...b,
      id: b.code,
      shortName: shortNameFor(b.code),
    })),
  };
}

export interface BranchRow {
  college: College;
  branch: Branch;
}

interface DataContextValue {
  meta: Meta;
  colleges: College[];
  collegesById: Map<string, College>;
  branchRows: BranchRow[];
  categories: Category[];
  categoryValues: string[];
  genders: string[];
  branchOptions: BranchInfo[];
  popularBranches: BranchInfo[];
  districts: string[];
  universities: string[];
  collegeTypes: string[];
  year: number;
  phase: string;
  getCollegeById: (id?: string) => College | undefined;
  categoryLabel: (value: string) => string;
  reload: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [apiColleges, setApiColleges] = useState<ApiCollege[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([getMeta(), getColleges()])
      .then(([m, c]) => {
        if (cancelled) return;
        setMeta(m);
        setApiColleges(c);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const value = useMemo<DataContextValue | null>(() => {
    if (!meta || !apiColleges) return null;
    const colleges = apiColleges.map(enrich);
    const collegesById = new Map(colleges.map((c) => [c.id, c]));
    const branchRows: BranchRow[] = colleges.flatMap((college) =>
      college.branches.map((branch) => ({ college, branch }))
    );
    const branchOptions: BranchInfo[] = meta.branches.map((b) => ({
      ...b,
      shortName: shortNameFor(b.code),
    }));
    const labelByValue = new Map(meta.categories.map((c) => [c.value, c.label]));

    return {
      meta,
      colleges,
      collegesById,
      branchRows,
      categories: meta.categories,
      categoryValues: meta.categories.map((c) => c.value),
      genders: meta.genders,
      branchOptions,
      popularBranches: branchOptions.slice(0, 12),
      districts: meta.districts,
      universities: meta.universities,
      collegeTypes: meta.collegeTypes,
      year: meta.year,
      phase: meta.phase,
      getCollegeById: (id?: string) => (id ? collegesById.get(id) : undefined),
      categoryLabel: (v: string) => labelByValue.get(v) ?? v,
      reload: () => setNonce((n) => n + 1),
    };
  }, [meta, apiColleges]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="material-symbols-outlined text-error text-6xl">cloud_off</span>
        <h2 className="text-xl font-bold text-on-surface">Can't reach the server</h2>
        <p className="text-on-surface-variant text-sm max-w-md">
          The College Kurchi API isn't responding ({error}). Make sure the backend is running on{' '}
          <code className="text-primary">localhost:8000</code> and MongoDB is seeded.
        </p>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
        <p className="text-on-surface-variant text-sm">Loading colleges…</p>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
