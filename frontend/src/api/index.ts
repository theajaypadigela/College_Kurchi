// Typed API functions, one per backend endpoint.
import { apiGet, apiPost } from './client';
import type {
  ApiCollege,
  ChatMessage,
  ChatResponse,
  CompareResponse,
  CutoffRow,
  Meta,
  PredictResponse,
  RecommendationResponse,
} from './types';

export const getMeta = () => apiGet<Meta>('/meta');

export const getColleges = (params?: {
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
}) => apiGet<ApiCollege[]>('/colleges', params);

export const getCollege = (code: string) => apiGet<ApiCollege>(`/colleges/${code}`);

export const getCutoffs = (params: {
  branch?: string;
  category?: string;
  gender?: string;
  district?: string;
  q?: string;
  limit?: number;
}) => apiGet<CutoffRow[]>('/cutoffs', params);

export const postRecommendations = (body: {
  rank: number;
  category: string;
  gender: string;
  branch: string;
  location?: string | null;
  maxFee?: number | null;
}) => apiPost<RecommendationResponse>('/recommendations', body);

export const postPredict = (body: {
  rank: number;
  category: string;
  gender: string;
  branch: string;
  collegeCode?: string | null;
}) => apiPost<PredictResponse>('/predict', body);

export const postCompare = (body: { codes: string[]; category?: string; gender?: string }) =>
  apiPost<CompareResponse>('/compare', body);

export const postChat = (body: {
  message: string;
  history?: ChatMessage[];
  userRank?: number | null;
  userCategory?: string | null;
  userGender?: string | null;
}) => apiPost<ChatResponse>('/counselor/chat', body);

export const authRegister = (body: import('./types').RegisterRequest) =>
  apiPost<import('./types').LoginResponse>('/auth/register', body);

export const authLogin = (email: string, password: string) =>
  apiPost<import('./types').LoginResponse>('/auth/login', { email, password });

export const authMe = () => apiGet<import('./types').User>('/auth/me');

export * from './types';
