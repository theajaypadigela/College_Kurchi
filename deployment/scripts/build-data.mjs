/**
 * Build static data for the no-backend deployment.
 *
 * Faithful port of backend/app/seed.py `normalize()` — reads the two raw
 * datasets from ./data and writes public/data/colleges.json + meta.json,
 * which the app fetches at runtime instead of calling an API.
 *
 * The only thing dropped vs. the backend is the per-college `embedding`
 * (used only for semantic RAG, which the static counselor replaces with
 * keyword retrieval).
 *
 * Run:  node scripts/build-data.mjs   (also runs automatically on `npm run build`)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');
const OUT_DIR = resolve(ROOT, 'public', 'data');

const CUTOFF_FILE = 'TGEAPCET_2025_FINALPHASE_LASTRANKS.json';
const TABLE_FILE = 'table-eapcet.json';

const DISTRICT_NAMES = {
  HNK: 'Hanumakonda', HYD: 'Hyderabad', JTL: 'Jagtial',
  KGM: 'Bhadradri Kothagudem', KHM: 'Khammam', KMR: 'Kamareddy',
  KRM: 'Karimnagar', MBN: 'Mahabubnagar', MDL: 'Medchal-Malkajgiri',
  MED: 'Medak', MHB: 'Mahabubabad', NLG: 'Nalgonda', NPT: 'Narayanpet',
  NZB: 'Nizamabad', PDL: 'Peddapalli', RR: 'Ranga Reddy', SDP: 'Siddipet',
  SRC: 'Rajanna Sircilla', SRD: 'Sangareddy', SRP: 'Suryapet',
  WGL: 'Warangal', WNP: 'Wanaparthy', YBG: 'Yadadri Bhuvanagiri',
};

const COLLEGE_TYPES = { GOV: 'Government', PVT: 'Private', SF: 'Self-Finance', UNIV: 'University' };

// (column prefix, category value, label)
const CATEGORY_COLUMNS = [
  ['oc', 'OC', 'OC'], ['ews', 'EWS', 'EWS'],
  ['bca', 'BC_A', 'BC-A'], ['bcb', 'BC_B', 'BC-B'], ['bcc', 'BC_C', 'BC-C'],
  ['bcd', 'BC_D', 'BC-D'], ['bce', 'BC_E', 'BC-E'],
  ['sc1', 'SC_1', 'SC-1'], ['sc2', 'SC_2', 'SC-2'], ['sc3', 'SC_3', 'SC-3'],
  ['st', 'ST', 'ST'],
];
const GENDERS = ['Boys', 'Girls'];

function cleanInt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value > 0 ? Math.trunc(value) : null;
  const s = String(value).trim().replace(/,/g, '');
  if (!s || !/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? n : null;
}

const cleanPlace = (v) => String(v ?? '').split(/\s+/).filter(Boolean).join(' ');

function cleanName(v) {
  let name = String(v ?? '').split(/\s+/).filter(Boolean).join(' ');
  const upper = name.toUpperCase();
  if (upper.startsWith('(AUTONOMOUS) ') && (upper.match(/\(AUTONOMOUS\)/g) || []).length > 1) {
    name = name.slice('(AUTONOMOUS) '.length).trim();
  }
  return name;
}

const splitRecruiters = (v) =>
  !v ? [] : String(v).split(',').map((r) => r.trim()).filter(Boolean);

function normalize() {
  const cutoff = JSON.parse(readFileSync(resolve(DATA_DIR, CUTOFF_FILE), 'utf-8'));
  const table = JSON.parse(readFileSync(resolve(DATA_DIR, TABLE_FILE), 'utf-8'));
  const feesByCode = Object.fromEntries(table.data.map((r) => [r.college_code, r]));

  const colleges = new Map();
  const branchNames = {};
  const branchCounter = new Map();

  for (const row of cutoff.data) {
    const code = row.inst_code;
    if (!colleges.has(code)) {
      const distCode = row.dist_code || '';
      const fees = feesByCode[code];
      colleges.set(code, {
        code,
        name: cleanName(row.institute_name),
        place: cleanPlace(row.place),
        distCode,
        district: DISTRICT_NAMES[distCode] ?? (distCode || ''),
        university: (row.affiliated_to || '').trim() || '-',
        type: COLLEGE_TYPES[row.college_type] ?? (row.college_type || ''),
        coEducation: row.co_education || '',
        feePerYear: fees ? (fees.fee_per_year ?? null) : null,
        totalFees: fees ? (fees.total_fees ?? null) : null,
        highestPackageLpa: fees ? (fees.highest_package_lpa ?? null) : null,
        averagePackageLpa: fees ? (fees.average_package_lpa ?? null) : null,
        topRecruiters: fees ? splitRecruiters(fees.top_recruiters) : [],
        branches: [],
      });
    }

    const bcode = row.branch_code;
    const bname = (row.branch_name || '').trim();
    branchNames[bcode] = bname;
    branchCounter.set(bcode, (branchCounter.get(bcode) || 0) + 1);

    const ranks = {};
    for (const [prefix, value] of CATEGORY_COLUMNS) {
      for (const gender of GENDERS) {
        const r = cleanInt(row[`${prefix}_${gender.toLowerCase()}`]);
        if (r !== null) ranks[`${value}|${gender}`] = r;
      }
    }
    colleges.get(code).branches.push({ code: bcode, name: bname, ranks });
  }

  const collegeList = [...colleges.values()].sort((a, b) => a.name.localeCompare(b.name));
  const BIG = 10 ** 9;
  for (const c of collegeList) {
    c.branches.sort((a, b) => {
      const ra = a.ranks['OC|Boys'] ?? BIG;
      const rb = b.ranks['OC|Boys'] ?? BIG;
      return ra - rb || a.code.localeCompare(b.code);
    });
  }

  const branchesByCount = [...branchCounter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, name: branchNames[code], count }));

  const meta = {
    year: cutoff.year ?? 2025,
    phase: cutoff.phase ?? 'final',
    categories: CATEGORY_COLUMNS.map(([, value, label]) => ({ value, label })),
    genders: GENDERS,
    branches: branchesByCount,
    districts: [...new Set(collegeList.map((c) => c.district).filter(Boolean))].sort(),
    universities: [...new Set(collegeList.map((c) => c.university).filter((u) => u !== '-'))].sort(),
    collegeTypes: [...new Set(collegeList.map((c) => c.type).filter(Boolean))].sort(),
    collegeCount: collegeList.length,
    // No server-side embeddings in the static build.
    embeddingBackend: 'none',
    embeddingDim: 0,
  };

  return { collegeList, meta };
}

const { collegeList, meta } = normalize();
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'colleges.json'), JSON.stringify(collegeList));
writeFileSync(resolve(OUT_DIR, 'meta.json'), JSON.stringify(meta));

const enriched = collegeList.filter((c) => c.feePerYear !== null).length;
console.log(
  `[build-data] wrote ${collegeList.length} colleges (${enriched} with fees/placements), ` +
  `${meta.branches.length} branches, ${meta.districts.length} districts ` +
  `→ public/data/{colleges,meta}.json`
);
