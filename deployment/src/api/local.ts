// Client-side ports of the backend business logic, computed over the static
// datasets. Faithful translations of:
//   backend/app/services/{recommendations,predictor,comparison,colleges}.py
//   backend/app/rag/{query_parser,retriever,counselor}.py
//
// These run entirely in the browser — no server. The AI Counselor and the
// comparison summary optionally call Groq from the browser (client.ts), and
// fall back to the deterministic templates below when no key is configured.

import { groqAvailable, groqChat, loadColleges, loadMeta } from './client';
import type {
  ApiBranch,
  ApiCollege,
  CompareResponse,
  CutoffRow,
  Meta,
  PredictResponse,
  RecommendationItem,
  RecommendationResponse,
  SafeAlternative,
} from './types';

// ── helpers ─────────────────────────────────────────────────────────────────
const rankKey = (category: string, gender: string) => `${category}|${gender}`;
const rankOf = (b: ApiBranch, category: string, gender: string): number | null => {
  const r = b.ranks[rankKey(category, gender)];
  return typeof r === 'number' ? r : null;
};
const findBranch = (c: ApiCollege, code: string): ApiBranch | undefined =>
  c.branches.find((b) => b.code === code);
const nf = (n: number) => n.toLocaleString('en-IN');

// ── colleges / meta / cutoffs (services/colleges.py) ─────────────────────────
export async function getMeta(): Promise<Meta> {
  return loadMeta();
}

export async function getColleges(params?: {
  q?: string;
  branch?: string;
  district?: string;
  type?: string;
  university?: string;
  minFee?: number;
  maxFee?: number;
  minAvgPackage?: number;
  codes?: string;
  sort?: string;
  limit?: number;
}): Promise<ApiCollege[]> {
  const p = params ?? {};
  let docs = await loadColleges();
  const codes = p.codes ? p.codes.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : null;

  docs = docs.filter((d) => {
    if (codes && !codes.includes(d.code)) return false;
    if (p.branch && !d.branches.some((b) => b.code === p.branch)) return false;
    if (p.district && d.district !== p.district) return false;
    if (p.type && d.type !== p.type) return false;
    if (p.university && d.university !== p.university) return false;
    if (p.minFee != null && (d.feePerYear ?? -Infinity) < p.minFee) return false;
    if (p.maxFee != null && (d.feePerYear ?? Infinity) > p.maxFee) return false;
    if (p.minAvgPackage != null && (d.averagePackageLpa ?? -Infinity) < p.minAvgPackage) return false;
    return true;
  });

  if (p.q) {
    const ql = p.q.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.name.toLowerCase().includes(ql) ||
        d.code.toLowerCase().includes(ql) ||
        (d.district || '').toLowerCase().includes(ql)
    );
  }

  docs = [...docs];
  if (p.sort === 'fee') docs.sort((a, b) => (a.feePerYear ?? 1e12) - (b.feePerYear ?? 1e12));
  else if (p.sort === 'package') docs.sort((a, b) => (b.averagePackageLpa ?? 0) - (a.averagePackageLpa ?? 0));
  else docs.sort((a, b) => a.name.localeCompare(b.name));

  if (p.limit) docs = docs.slice(0, p.limit);
  return docs;
}

export async function getCollege(code: string): Promise<ApiCollege> {
  const docs = await loadColleges();
  const c = docs.find((d) => d.code === code.toUpperCase());
  if (!c) throw new Error('College not found');
  return c;
}

export async function getCutoffs(params: {
  branch?: string;
  category?: string;
  gender?: string;
  district?: string;
  q?: string;
  limit?: number;
}): Promise<CutoffRow[]> {
  const docs = await loadColleges();
  const category = params.category ?? 'OC';
  const gender = params.gender ?? 'Boys';
  const limit = params.limit ?? 400;
  const ql = params.q ? params.q.toLowerCase() : null;
  const rows: CutoffRow[] = [];

  for (const c of docs) {
    if (params.district && c.district !== params.district) continue;
    if (params.branch && !c.branches.some((b) => b.code === params.branch)) continue;
    if (ql && !(c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql))) continue;
    for (const b of c.branches) {
      if (params.branch && b.code !== params.branch) continue;
      const r = rankOf(b, category, gender);
      if (r === null) continue;
      rows.push({
        collegeCode: c.code,
        collegeName: c.name,
        district: c.district ?? '',
        university: c.university ?? '',
        type: c.type ?? '',
        branchCode: b.code,
        branchName: b.name,
        closingRank: r,
      });
    }
  }
  rows.sort((a, b) => a.closingRank - b.closingRank);
  return rows.slice(0, limit);
}

// ── recommendations (services/recommendations.py) ────────────────────────────
const SAFE_MARGIN = 7000;
const DREAM_MARGIN = -7000;

function recommendReason(
  bucket: string,
  diff: number,
  closing: number,
  c: ApiCollege,
  hasLocation: boolean
): string {
  const loc = hasLocation ? ` in ${c.district}` : '';
  const pkg = c.averagePackageLpa ? ` Avg package ${c.averagePackageLpa} LPA.` : '';
  if (bucket === 'safe')
    return `Closing rank ${nf(closing)} is ~${nf(diff)} above your rank${loc}, so admission is very likely.${pkg}`;
  if (bucket === 'moderate')
    return `Closing rank ${nf(closing)} is close to your rank — a strong, realistic match${loc}.${pkg}`;
  return `Closing rank ${nf(closing)} is just below your rank — a competitive stretch worth listing high.${pkg}`;
}

export async function postRecommendations(body: {
  rank: number;
  category: string;
  gender: string;
  branch: string;
  location?: string | null;
  maxFee?: number | null;
}): Promise<RecommendationResponse> {
  const docs = await loadColleges();
  const key = rankKey(body.category, body.gender);
  const dream: RecommendationItem[] = [];
  const moderate: RecommendationItem[] = [];
  const safe: RecommendationItem[] = [];

  for (const c of docs) {
    if (body.location && c.district !== body.location) continue;
    if (body.maxFee && c.feePerYear != null && c.feePerYear > body.maxFee) continue;
    const b = findBranch(c, body.branch);
    if (!b) continue;
    const closing = b.ranks[key];
    if (closing == null) continue;
    const diff = closing - body.rank;
    if (diff < DREAM_MARGIN) continue;

    const bucket: 'safe' | 'moderate' | 'dream' =
      diff >= SAFE_MARGIN ? 'safe' : diff >= 0 ? 'moderate' : 'dream';

    const item: RecommendationItem = {
      college: c,
      branchCode: body.branch,
      branchName: b.name,
      closingRank: closing,
      bucket,
      reason: recommendReason(bucket, diff, closing, c, Boolean(body.location)),
    };
    ({ dream, moderate, safe }[bucket]).push(item);
  }

  for (const lst of [dream, moderate, safe]) lst.sort((a, b) => a.closingRank - b.closingRank);
  return { dream: dream.slice(0, 20), moderate: moderate.slice(0, 20), safe: safe.slice(0, 20) };
}

// ── predictor (services/predictor.py) ────────────────────────────────────────
function probability(cutoffRank: number | null, rank: number): number {
  if (cutoffRank === null) return 60;
  const diff = cutoffRank - rank;
  let prob: number;
  if (diff >= 10000) prob = 95;
  else if (diff >= 5000) prob = Math.round(70 + ((diff - 5000) / 1000) * 5);
  else if (diff >= 0) prob = Math.round(50 + (diff / 5000) * 20);
  else if (diff >= -5000) prob = Math.round(50 + (diff / 5000) * 30);
  else prob = Math.round(20 + (diff / 1000) * 3);
  return Math.max(5, Math.min(98, prob));
}

export async function postPredict(body: {
  rank: number;
  category: string;
  gender: string;
  branch: string;
  collegeCode?: string | null;
}): Promise<PredictResponse> {
  const docs = await loadColleges();
  const key = rankKey(body.category, body.gender);
  let cutoffRank: number | null = null;
  let collegeName: string | null = null;
  const targetCode = body.collegeCode ? body.collegeCode.toUpperCase() : null;

  if (targetCode) {
    const c = docs.find((d) => d.code === targetCode);
    if (c) {
      collegeName = c.name;
      const b = findBranch(c, body.branch);
      if (b) cutoffRank = b.ranks[key] ?? null;
    }
  }

  const prob = probability(cutoffRank, body.rank);
  const classification: 'HIGH' | 'MEDIUM' | 'LOW' = prob >= 70 ? 'HIGH' : prob >= 40 ? 'MEDIUM' : 'LOW';

  let reasoning: string;
  if (cutoffRank !== null) {
    reasoning =
      cutoffRank >= body.rank
        ? `The ${body.branch} closing rank was ${nf(cutoffRank)}, which is above your rank (${nf(body.rank)}). You have a ${classification.toLowerCase()} chance of admission.`
        : `The ${body.branch} closing rank was ${nf(cutoffRank)}, better than your rank (${nf(body.rank)}). Admission would be challenging.`;
  } else {
    reasoning = `Estimated from your rank (${nf(body.rank)}) in ${body.category}. Pick a target college for a precise, cutoff-based prediction.`;
  }

  const pool: { c: ApiCollege; r: number }[] = [];
  for (const c of docs) {
    if (targetCode && c.code === targetCode) continue;
    const b = findBranch(c, body.branch);
    if (!b) continue;
    const r = b.ranks[key];
    if (r != null && r >= body.rank + 5000) pool.push({ c, r });
  }
  pool.sort((a, b) => a.r - b.r);
  const safeAlternatives: SafeAlternative[] = pool
    .slice(0, 4)
    .map(({ c, r }) => ({ code: c.code, name: c.name, closingRank: r }));

  return {
    collegeName,
    branch: body.branch,
    cutoffRank,
    probability: prob,
    classification,
    reasoning,
    safeAlternatives,
  };
}

// ── comparison (services/comparison.py) ──────────────────────────────────────
const PREFERRED_BRANCHES = ['CSE', 'ECE', 'INF', 'EEE', 'CSM', 'MEC', 'CIV'];

const COMPARE_SYSTEM =
  'You are College Kurchi. Compare the given TS EAMCET colleges using ONLY the facts ' +
  'provided. Write 3-5 short markdown bullets covering the meaningful differences in ' +
  'cutoff ranks, fees, placements, location and branches, then a one-line takeaway ' +
  "('Best for ...'). Never invent numbers. Refer to colleges by name with code.";

function compareFacts(colleges: ApiCollege[], category: string, gender: string): string {
  const lines: string[] = [];
  for (const c of colleges) {
    const bits = [`${c.name} (${c.code}): ${c.district}, ${c.type}, ${c.university}`];
    if (c.feePerYear) bits.push(`fee/yr Rs ${nf(c.feePerYear)}`);
    if (c.totalFees) bits.push(`total Rs ${nf(c.totalFees)}`);
    if (c.averagePackageLpa) bits.push(`avg package ${c.averagePackageLpa} LPA`);
    if (c.highestPackageLpa) bits.push(`highest ${c.highestPackageLpa} LPA`);
    const cutoffs: string[] = [];
    for (const bc of PREFERRED_BRANCHES) {
      const b = findBranch(c, bc);
      const r = b ? rankOf(b, category, gender) : null;
      if (r !== null) cutoffs.push(`${bc} ${nf(r)}`);
    }
    if (cutoffs.length) bits.push(`${category} ${gender} closing: ${cutoffs.join(', ')}`);
    if (c.topRecruiters.length) bits.push(`recruiters: ${c.topRecruiters.slice(0, 5).join(', ')}`);
    lines.push('- ' + bits.join(' | '));
  }
  return lines.join('\n');
}

function compareTemplate(colleges: ApiCollege[], category: string, gender: string): string {
  if (colleges.length < 2) return 'Add at least two colleges to see a comparison summary.';
  const out: string[] = [];

  const feeKnown = colleges.filter((c) => c.feePerYear);
  if (feeKnown.length) {
    const cheapest = feeKnown.reduce((a, b) => ((a.feePerYear ?? 0) <= (b.feePerYear ?? 0) ? a : b));
    out.push(`• **Lowest fee:** ${cheapest.name} (${cheapest.code}) at Rs ${nf(cheapest.feePerYear!)}/yr.`);
  }
  const pkgKnown = colleges.filter((c) => c.averagePackageLpa);
  if (pkgKnown.length) {
    const best = pkgKnown.reduce((a, b) => ((a.averagePackageLpa ?? 0) >= (b.averagePackageLpa ?? 0) ? a : b));
    out.push(`• **Best average placement:** ${best.name} (${best.code}) at ${best.averagePackageLpa} LPA.`);
  }
  const cse = colleges
    .map((c) => ({ c, r: (() => { const b = findBranch(c, 'CSE'); return b ? rankOf(b, category, gender) : null; })() }))
    .filter((x) => x.r !== null) as { c: ApiCollege; r: number }[];
  if (cse.length) {
    const most = cse.reduce((a, b) => (a.r <= b.r ? a : b));
    out.push(
      `• **Most competitive CSE (${category} ${gender}):** ${most.c.name} (${most.c.code}) closing at ${nf(most.r)} — toughest to get into.`
    );
  }
  const districts = [...new Set(colleges.map((c) => c.district).filter(Boolean))];
  if (districts.length > 1) out.push('• **Location varies:** ' + districts.sort().join(', ') + '.');
  out.push('• **Takeaway:** weigh a tougher cutoff/better placements against fee and location for your rank.');
  return out.join('\n');
}

export async function postCompare(body: {
  codes: string[];
  category?: string;
  gender?: string;
}): Promise<CompareResponse> {
  const docs = await loadColleges();
  const category = body.category ?? 'OC';
  const gender = body.gender ?? 'Boys';
  const byCode = new Map(docs.map((c) => [c.code, c]));
  const colleges = body.codes
    .map((code) => byCode.get(code.toUpperCase()))
    .filter((c): c is ApiCollege => Boolean(c));

  if (!colleges.length) return { colleges: [], aiSummary: 'No matching colleges found.' };

  let summary = compareTemplate(colleges, category, gender);
  if (groqAvailable() && colleges.length >= 2) {
    try {
      const context = compareFacts(colleges, category, gender);
      const llm = await groqChat(
        COMPARE_SYSTEM,
        [{ role: 'user', content: `Colleges:\n${context}\n\nCompare them for a ${category} ${gender} student.` }],
        { maxTokens: 600 }
      );
      if (llm) summary = llm;
    } catch (e) {
      console.warn('[compare] Groq error, using template:', e);
    }
  }
  return { colleges, aiSummary: summary };
}

export { compareTemplate };
