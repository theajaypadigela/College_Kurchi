// Shapes returned by the backend API, plus the enriched frontend types
// (which add `id`, `region`, and branch `shortName` so the pages have a stable shape).

export interface ApiBranch {
  code: string;
  name: string;
  ranks: Record<string, number>; // "OC|Boys" -> closing rank
}

export interface ApiCollege {
  code: string;
  name: string;
  place: string;
  district: string;
  distCode: string;
  university: string;
  type: string;
  coEducation: string;
  feePerYear: number | null;
  totalFees: number | null;
  highestPackageLpa: number | null;
  averagePackageLpa: number | null;
  topRecruiters: string[];
  branches: ApiBranch[];
}

// Enriched for the UI
export interface Branch extends ApiBranch {
  id: string; // = code
  shortName: string;
}

export interface College extends Omit<ApiCollege, 'branches'> {
  id: string; // = code
  region: string; // = university (legacy alias used across the UI)
  branches: Branch[];
}

export interface Category {
  value: string;
  label: string;
}

export interface BranchInfo {
  code: string;
  name: string;
  count: number;
  shortName: string;
}

export interface Meta {
  year: number;
  phase: string;
  categories: Category[];
  genders: string[];
  branches: { code: string; name: string; count: number }[];
  districts: string[];
  universities: string[];
  collegeTypes: string[];
  collegeCount: number;
  embeddingBackend: string;
  embeddingDim: number;
}

export interface CutoffRow {
  collegeCode: string;
  collegeName: string;
  district: string;
  university: string;
  type: string;
  branchCode: string;
  branchName: string;
  closingRank: number;
}

export interface RecommendationItem {
  college: ApiCollege;
  branchCode: string;
  branchName: string;
  closingRank: number;
  bucket: 'dream' | 'moderate' | 'safe';
  reason: string;
}

export interface RecommendationResponse {
  dream: RecommendationItem[];
  moderate: RecommendationItem[];
  safe: RecommendationItem[];
}

export interface SafeAlternative {
  code: string;
  name: string;
  closingRank: number;
}

export interface PredictResponse {
  collegeName: string | null;
  branch: string;
  cutoffRank: number | null;
  probability: number;
  classification: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  safeAlternatives: SafeAlternative[];
}

export interface CompareResponse {
  colleges: ApiCollege[];
  aiSummary: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSource {
  code: string;
  name: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  parsed: Record<string, unknown>;
  usedLlm: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  rank: number;
  category: string;
  gender: string;
  phone?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  rank: number;
  category: string;
  gender: string;
  phone?: string;
}
