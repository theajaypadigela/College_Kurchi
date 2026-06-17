// Client-side AI Counselor — ports the backend RAG pipeline
// (backend/app/rag/{query_parser,retriever,counselor}.py) to the browser.
//
// Pipeline: parse free text → keyword retrieval over the static dataset →
// build grounding context → answer. If a Groq key is configured (client.ts)
// the grounded context is sent to the LLM; otherwise the deterministic
// template answer is returned. Semantic/vector retrieval is replaced with
// keyword + structured retrieval (no embeddings shipped to the browser).

import { groqAvailable, groqChat, loadColleges, loadMeta } from './client';
import type { ApiBranch, ApiCollege, ChatMessage, ChatResponse, ChatSource, Meta } from './types';

const rankKey = (category: string, gender: string) => `${category}|${gender}`;
const rankOf = (b: ApiBranch, category: string, gender: string): number | null => {
  const r = b.ranks[rankKey(category, gender)];
  return typeof r === 'number' ? r : null;
};
const findBranch = (c: ApiCollege, code: string): ApiBranch | undefined =>
  c.branches.find((b) => b.code === code);
const nf = (n: number) => n.toLocaleString('en-IN');

// ── query parser (query_parser.py) ──────────────────────────────────────────
interface ParsedQuery {
  intent: string;
  rank: number | null;
  branch: string | null;
  branchSpecified: boolean;
  category: string;
  categorySpecified: boolean;
  gender: string;
  genderSpecified: boolean;
  location: string | null;
  collegeCodes: string[];
  maxFee: number | null;
}

const BRANCH_PATTERNS: [RegExp, string][] = [
  [/\bcse\b|computer science(?! and (business|design))|comp sci/, 'CSE'],
  [/aiml|ai\s*&?\s*ml|machine learning|artificial intelligence and machine/, 'CSM'],
  [/data science|\bai\s*&?\s*ds\b|\baids\b/, 'CSD'],
  [/cyber security|cyber\b/, 'CSC'],
  [/\bece\b|electronics and communication/, 'ECE'],
  [/information technology|\bit\b(?= branch| course| college| seat)/, 'INF'],
  [/\beee\b|electrical/, 'EEE'],
  [/\bmech(anical)?\b/, 'MEC'],
  [/\bcivil\b/, 'CIV'],
  [/aero(nautical)?/, 'ANE'],
  [/\bbiotech|bio-?technology/, 'BIO'],
  [/chemical/, 'CHE'],
];

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/\bews\b|economically weaker/, 'EWS'],
  [/\bbc[-\s]?a\b|\bbca\b/, 'BC_A'],
  [/\bbc[-\s]?b\b|\bbcb\b/, 'BC_B'],
  [/\bbc[-\s]?c\b|\bbcc\b/, 'BC_C'],
  [/\bbc[-\s]?d\b|\bbcd\b/, 'BC_D'],
  [/\bbc[-\s]?e\b|\bbce\b/, 'BC_E'],
  [/\bsc[-\s]?1\b|\bsc1\b/, 'SC_1'],
  [/\bsc[-\s]?2\b|\bsc2\b/, 'SC_2'],
  [/\bsc[-\s]?3\b|\bsc3\b/, 'SC_3'],
  [/\bst\b|scheduled tribe/, 'ST'],
  [/\bbc\b|backward class/, 'BC_B'],
  [/\bsc\b|scheduled caste/, 'SC_1'],
  [/\boc\b|open category|general category/, 'OC'],
];

const RANK_RE = /\b(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(k|thousand)?\b/gi;
const FEE_RE = /(?:under|below|less than|max|budget|upto|up to)\s*(?:rs\.?|₹)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(k|l|lakh|lakhs|lpa)?/i;

function parseRank(q: string): number | null {
  RANK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RANK_RE.exec(q)) !== null) {
    const raw = m[1];
    const suffix = m[2];
    const hasComma = raw.includes(',');
    if (!hasComma && !suffix && !q.includes('rank')) continue;
    let n = parseInt(raw.replace(/,/g, ''), 10);
    if (suffix && ['k', 'thousand'].includes(suffix.toLowerCase())) n *= 1000;
    if (n > 0 && n <= 500000) return n;
  }
  return null;
}

function parseFee(q: string): number | null {
  const m = FEE_RE.exec(q);
  if (!m) return null;
  let n = parseInt(m[1].replace(/,/g, ''), 10);
  const unit = (m[2] || '').toLowerCase();
  if (['l', 'lakh', 'lakhs'].includes(unit)) n *= 100000;
  else if (unit === 'k') n *= 1000;
  if (unit === 'lpa') return null;
  return n >= 1000 ? n : null;
}

// Distinctive name tokens, mirroring index.name_tokens (drop generic words).
const STOPWORDS = new Set([
  'college', 'institute', 'engineering', 'technology', 'and', 'of', 'the', 'science',
  'sciences', 'institutes', 'inst', 'tech', 'for', 'school', 'autonomous', 'university',
  'colleges', 'group', 'academy',
]);

function detectColleges(q: string, colleges: ApiCollege[]): string[] {
  const tokens = new Set((q.match(/[a-z0-9]+/g) ?? []));
  const found: string[] = [];
  for (const c of colleges) {
    if (c.code.length >= 3 && tokens.has(c.code.toLowerCase())) found.push(c.code);
  }
  for (const c of colleges) {
    if (found.includes(c.code)) continue;
    const nameToks = (c.name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (t) => t.length >= 4 && !STOPWORDS.has(t)
    );
    if (nameToks.some((t) => tokens.has(t))) found.push(c.code);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of found) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out.slice(0, 4);
}

function parse(message: string, colleges: ApiCollege[], meta: Meta): ParsedQuery {
  const q = ' ' + message.toLowerCase().trim() + ' ';
  const pq: ParsedQuery = {
    intent: 'general',
    rank: parseRank(q),
    branch: null,
    branchSpecified: false,
    category: 'OC',
    categorySpecified: false,
    gender: 'Boys',
    genderSpecified: false,
    location: null,
    collegeCodes: [],
    maxFee: parseFee(q),
  };

  for (const [pat, code] of BRANCH_PATTERNS) {
    if (pat.test(q)) {
      pq.branch = code;
      pq.branchSpecified = true;
      break;
    }
  }
  for (const [pat, value] of CATEGORY_PATTERNS) {
    if (pat.test(q)) {
      pq.category = value;
      pq.categorySpecified = true;
      break;
    }
  }
  if (/\bgirl|female|women|ladies\b/.test(q)) {
    pq.gender = 'Girls';
    pq.genderSpecified = true;
  } else if (/\bboy|male|men\b/.test(q)) {
    pq.gender = 'Boys';
    pq.genderSpecified = true;
  }
  for (const d of meta.districts) {
    if (q.includes(d.toLowerCase())) {
      pq.location = d;
      break;
    }
  }
  pq.collegeCodes = detectColleges(q, colleges);

  if (q.includes('compare') || q.includes(' vs ') || q.includes('versus') || pq.collegeCodes.length >= 2)
    pq.intent = 'compare';
  else if (/chance|predict|will i get|can i get into|my chances/.test(q)) pq.intent = 'predict';
  else if (pq.rank !== null) pq.intent = 'recommend';
  else if (q.includes('top') || q.includes('best') || q.includes('good colleges')) pq.intent = 'top';
  else pq.intent = 'general';

  return pq;
}

// ── retrieval (retriever.py) ─────────────────────────────────────────────────
function retrieve(parsed: ParsedQuery, colleges: ApiCollege[], limit = 10): ApiCollege[] {
  const picked: ApiCollege[] = [];
  const seen = new Set<string>();
  const byCode = new Map(colleges.map((c) => [c.code, c]));
  const add = (c?: ApiCollege) => {
    if (c && !seen.has(c.code)) {
      seen.add(c.code);
      picked.push(c);
    }
  };

  for (const code of parsed.collegeCodes) add(byCode.get(code));

  if (parsed.branch) {
    const rows: { c: ApiCollege; r: number }[] = [];
    for (const c of colleges) {
      const b = findBranch(c, parsed.branch);
      if (!b) continue;
      const r = rankOf(b, parsed.category, parsed.gender);
      if (r === null) continue;
      if (parsed.location && !(c.district || '').toLowerCase().includes(parsed.location.toLowerCase())) continue;
      if (parsed.maxFee && c.feePerYear && c.feePerYear > parsed.maxFee) continue;
      rows.push({ c, r });
    }
    if (parsed.rank !== null) {
      const gettable = rows.filter((x) => x.r >= parsed.rank!).sort((a, b) => a.r - b.r);
      const reach = rows.filter((x) => x.r < parsed.rank!).sort((a, b) => b.r - a.r);
      for (const { c } of gettable.slice(0, 6)) add(c);
      for (const { c } of reach.slice(0, 2)) add(c);
    } else {
      for (const { c } of [...rows].sort((a, b) => a.r - b.r).slice(0, 8)) add(c);
    }
  }

  // Keyword fallback (replaces semantic retrieval): top colleges by OC|Boys.
  if (picked.length < limit) {
    const rest = [...colleges]
      .map((c) => ({ c, r: findBranch(c, 'CSE') ? rankOf(findBranch(c, 'CSE')!, 'OC', 'Boys') : null }))
      .filter((x) => x.r !== null)
      .sort((a, b) => (a.r as number) - (b.r as number));
    for (const { c } of rest) {
      if (picked.length >= limit) break;
      add(c);
    }
  }

  return picked.slice(0, limit);
}

// ── grounding context + template answer (counselor.py) ───────────────────────
const SYSTEM_PROMPT =
  'You are College Kurchi, a friendly, precise counseling assistant for TS EAMCET ' +
  '(Telangana engineering admissions). Answer the student\'s question using ONLY the ' +
  'facts in the provided CONTEXT, which comes from the official last-ranks dataset. ' +
  'Rules:\n' +
  '- If a STUDENT PROFILE is provided, use that rank, category, and gender to ' +
  'personalise your answer. Do NOT ask the student for their rank or preferences ' +
  'when the profile is already given.\n' +
  '- Never invent colleges, ranks, fees, or packages. If the answer is not in the ' +
  'CONTEXT, say you don\'t have that data.\n' +
  '- A college is \'gettable\' for a rank when its closing rank is greater than or equal ' +
  'to the student\'s rank (lower closing rank = more competitive).\n' +
  '- Refer to colleges by name with their code in brackets, e.g. CBIT (CBIT).\n' +
  '- Be concise. Use short markdown bullets. Explain the reasoning briefly.\n' +
  '- All cutoffs are from the final phase; mention the year when relevant.';

function categoryLabel(meta: Meta, value: string): string {
  return meta.categories.find((c) => c.value === value)?.label ?? value;
}

const fmtMoney = (v: number | null) => (v ? `Rs ${nf(v)}` : 'n/a');

function collegeContext(c: ApiCollege, parsed: ParsedQuery, meta: Meta): string {
  const { category: cat, gender: gen } = parsed;
  const label = categoryLabel(meta, cat);
  const parts = [`${c.name} (${c.code}) — ${c.district ?? ''}, ${c.university ?? ''}, ${c.type ?? ''}`];

  if (parsed.branch) {
    const b = findBranch(c, parsed.branch);
    if (b) {
      const r = rankOf(b, cat, gen);
      parts.push(`${b.code} closing rank (${label} ${gen}): ${r !== null ? r : 'not offered'}`);
    }
  } else {
    const brs = c.branches
      .map((b) => ({ b, r: rankOf(b, 'OC', 'Boys') }))
      .filter((x) => x.r !== null)
      .sort((a, b) => (a.r as number) - (b.r as number));
    if (brs.length)
      parts.push('branches (OC Boys closing): ' + brs.slice(0, 3).map(({ b, r }) => `${b.code} ${r}`).join(', '));
  }

  const extra: string[] = [];
  if (c.feePerYear) extra.push(`fee/yr ${fmtMoney(c.feePerYear)}`);
  if (c.averagePackageLpa) extra.push(`avg package ${c.averagePackageLpa} LPA`);
  if (c.highestPackageLpa) extra.push(`highest ${c.highestPackageLpa} LPA`);
  if (c.topRecruiters.length) extra.push('recruiters: ' + c.topRecruiters.slice(0, 5).join(', '));
  if (extra.length) parts.push(extra.join('; '));
  return '- ' + parts.join(' | ');
}

function buildContext(colleges: ApiCollege[], parsed: ParsedQuery, meta: Meta): string {
  if (!colleges.length) return '(no matching colleges found in the dataset)';
  return colleges.map((c) => collegeContext(c, parsed, meta)).join('\n');
}

function templateAnswer(parsed: ParsedQuery, colleges: ApiCollege[], meta: Meta): string {
  const year = meta.year;
  const label = categoryLabel(meta, parsed.category);
  if (!colleges.length)
    return `I couldn't find colleges matching that in the TS EAMCET ${year} dataset. Try naming a branch (e.g. CSE), a rank, or a location.`;

  if (parsed.intent === 'compare' && parsed.collegeCodes.length >= 2) {
    const lines = [`**Comparing ${colleges.length} colleges (TS EAMCET ${year}):**`, ''];
    for (const c of colleges) {
      const bits = [`**${c.name} (${c.code})** — ${c.district ?? ''}, ${c.type ?? ''}`];
      if (parsed.branch) {
        const b = findBranch(c, parsed.branch);
        if (b) {
          const r = rankOf(b, parsed.category, parsed.gender);
          bits.push(`${parsed.branch} ${label} ${parsed.gender} closing: ${r !== null ? nf(r) : 'n/a'}`);
        }
      }
      if (c.feePerYear) bits.push(`fee/yr Rs ${nf(c.feePerYear)}`);
      if (c.averagePackageLpa) bits.push(`avg ${c.averagePackageLpa} LPA`);
      lines.push('• ' + bits.join(' · '));
    }
    return lines.join('\n');
  }

  if (['recommend', 'predict'].includes(parsed.intent) && parsed.rank && parsed.branch) {
    const branch = parsed.branch;
    const gettable: { c: ApiCollege; r: number }[] = [];
    for (const c of colleges) {
      const b = findBranch(c, branch);
      if (!b) continue;
      const r = rankOf(b, parsed.category, parsed.gender);
      if (r !== null && r >= parsed.rank) gettable.push({ c, r });
    }
    gettable.sort((a, b) => a.r - b.r);
    const header =
      `**${branch} colleges for rank ${nf(parsed.rank)} (${label} ${parsed.gender}, ${year})` +
      (parsed.location ? ` in ${parsed.location}` : '') +
      ':**';
    if (!gettable.length)
      return (
        header +
        '\n\nNo colleges in the dataset had a closing rank at or above your rank for this branch/category. Consider a less competitive branch or removing the location filter.'
      );
    const lines = [header, ''];
    for (const { c, r } of gettable.slice(0, 6)) {
      const extra = c.averagePackageLpa ? ` · avg ${c.averagePackageLpa} LPA` : '';
      lines.push(`• ${c.name} (${c.code}) — closing ${nf(r)}${extra}`);
    }
    lines.push('\nThese closing ranks are at or above your rank, so you have a good chance.');
    return lines.join('\n');
  }

  const lines = [`**Relevant colleges (TS EAMCET ${year}):**`, ''];
  for (const c of colleges.slice(0, 6)) {
    const bits = [`${c.name} (${c.code})`, c.district ?? ''];
    const b = parsed.branch ? findBranch(c, parsed.branch) : undefined;
    if (b) {
      const r = rankOf(b, parsed.category, parsed.gender);
      if (r !== null) bits.push(`${parsed.branch} closing ${nf(r)}`);
    }
    if (c.averagePackageLpa) bits.push(`avg ${c.averagePackageLpa} LPA`);
    lines.push('• ' + bits.filter(Boolean).join(' · '));
  }
  return lines.join('\n');
}

export async function postChat(body: {
  message: string;
  history?: ChatMessage[];
  userRank?: number | null;
  userCategory?: string | null;
  userGender?: string | null;
}): Promise<ChatResponse> {
  const [colleges, meta] = await Promise.all([loadColleges(), loadMeta()]);
  const parsed = parse(body.message, colleges, meta);

  // Merge logged-in profile as defaults (counselor.py).
  if (parsed.rank === null && body.userRank != null) {
    parsed.rank = body.userRank;
    if (!parsed.branchSpecified) parsed.branch = 'CSE';
    if (parsed.intent === 'general') parsed.intent = 'recommend';
  }
  if (!parsed.categorySpecified && body.userCategory) parsed.category = body.userCategory;
  if (!parsed.genderSpecified && body.userGender) parsed.gender = body.userGender;

  const retrieved = retrieve(parsed, colleges, 8);
  const context = buildContext(retrieved, parsed, meta);
  const sources: ChatSource[] = retrieved.map((c) => ({ code: c.code, name: c.name }));

  const profileParts: string[] = [];
  if (parsed.rank !== null) profileParts.push(`rank ${nf(parsed.rank)}`);
  if (parsed.category) profileParts.push(`category ${categoryLabel(meta, parsed.category)}`);
  if (parsed.gender) profileParts.push(parsed.gender);
  const profileLine = profileParts.length ? `STUDENT PROFILE: ${profileParts.join(', ')}\n\n` : '';

  let answer = templateAnswer(parsed, retrieved, meta);
  let usedLlm = false;

  if (groqAvailable() && retrieved.length) {
    try {
      const history = (body.history ?? [])
        .slice(-6)
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      const msgs = [
        ...history,
        {
          role: 'user' as const,
          content: `${profileLine}CONTEXT (TS EAMCET ${meta.year} final phase):\n${context}\n\nQUESTION: ${body.message}`,
        },
      ];
      const llm = await groqChat(SYSTEM_PROMPT, msgs);
      if (llm) {
        answer = llm;
        usedLlm = true;
      }
    } catch (e) {
      console.warn('[counselor] Groq error, using template:', e);
    }
  }

  return { answer, sources, parsed: parsed as unknown as Record<string, unknown>, usedLlm };
}
