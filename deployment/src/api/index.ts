// Public API surface — same function signatures the pages already import,
// but every call is computed locally over the static datasets (no backend).
// See ./local.ts, ./counselor.ts and ./auth.ts for the implementations.

export {
  getMeta,
  getColleges,
  getCollege,
  getCutoffs,
  postRecommendations,
  postPredict,
  postCompare,
} from './local';

export { postChat } from './counselor';

export { authRegister, authLogin, authMe } from './auth';

export * from './types';
