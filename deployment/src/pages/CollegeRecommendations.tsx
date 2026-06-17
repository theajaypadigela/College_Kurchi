import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { postRecommendations } from '../api';
import type { RecommendationItem, RecommendationResponse } from '../api/types';

type Bucket = 'dream' | 'moderate' | 'safe';

const TAB_DESCRIPTIONS: Record<Bucket, string> = {
  dream: 'Stretch options — competitive colleges just above your rank range. Worth trying!',
  moderate: 'Best matches — colleges where your rank is within the ideal range.',
  safe: 'Secure options — colleges very likely to admit you based on your rank.',
};

const TAB_COLORS: Record<Bucket, string> = {
  dream: 'bg-orange-100 text-orange-700',
  moderate: 'bg-primary/10 text-primary',
  safe: 'bg-green-100 text-green-700',
};

function getStoredShortlist(): string[] {
  try {
    const raw = localStorage.getItem('college-kurchi-shortlist');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function CollegeRecommendations(): React.ReactElement {
  const navigate = useNavigate();
  const { categories, genders, popularBranches, districts, year } = useData();
  const { user } = useAuth();

  const [rank, setRank] = useState<number>(user?.rank ?? 0);
  const [category, setCategory] = useState<string>(user?.category ?? '');
  const [gender, setGender] = useState<string>(user?.gender ?? '');
  const [branch, setBranch] = useState<string>('CSE');
  const [location, setLocation] = useState<string>('');
  const [maxFee, setMaxFee] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Bucket>('moderate');

  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shortlist, setShortlist] = useState<string[]>(getStoredShortlist);

  const toggleShortlist = (code: string): void => {
    const updated = shortlist.includes(code) ? shortlist.filter(x => x !== code) : [...shortlist, code];
    setShortlist(updated);
    localStorage.setItem('college-kurchi-shortlist', JSON.stringify(updated));
  };

  const fetchRecommendations = useCallback(() => {
    setLoading(true);
    setError(null);
    postRecommendations({
      rank,
      category,
      gender,
      branch,
      location: location || null,
      maxFee: maxFee ? Number(maxFee) : null,
    })
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [rank, category, gender, branch, location, maxFee]);

  // Sync state when user data loads (e.g. on page refresh)
  useEffect(() => {
    if (user) {
      setRank(user.rank);
      setCategory(user.category);
      setGender(user.gender);
    }
  }, [user]);

  // Fetch recommendations once user data is available
  useEffect(() => {
    if (user) {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.rank, user?.category, user?.gender]);

  const activeResults: RecommendationItem[] = result ? result[activeTab] : [];
  const counts = {
    dream: result?.dream.length ?? 0,
    moderate: result?.moderate.length ?? 0,
    safe: result?.safe.length ?? 0,
  };

  const selectClass =
    'border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-full';
  const labelClass = 'block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wide';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface mb-1">College Recommendations</h1>
        <p className="text-on-surface-variant text-sm">
          Personalised Dream / Moderate / Safe suggestions from the TS EAMCET {year} dataset.
        </p>
      </div>

      {/* Input form */}
      <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6 mb-6">
        <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
          Your Profile
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className={labelClass}>Your Rank</label>
            <input
              type="number"
              value={rank}
              min={1}
              max={300000}
              onChange={e => setRank(Number(e.target.value))}
              className={selectClass}
              placeholder="e.g. 12500"
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className={selectClass}>
              {genders.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Branch</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} className={selectClass}>
              {popularBranches.map(b => (
                <option key={b.code} value={b.code}>{b.shortName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <select value={location} onChange={e => setLocation(e.target.value)} className={selectClass}>
              <option value="">Any district</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Max Fee/yr</label>
            <input
              type="number"
              value={maxFee}
              min={0}
              onChange={e => setMaxFee(e.target.value)}
              className={selectClass}
              placeholder="Any"
            />
          </div>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="mt-4 bg-primary text-on-primary rounded-lg px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
            {loading ? 'progress_activity' : 'auto_awesome'}
          </span>
          {loading ? 'Finding colleges…' : 'Get Recommendations'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-error-container/30 text-error border border-error/20 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['dream', 'moderate', 'safe'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'bg-white border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? 'bg-white/20 text-on-primary' : TAB_COLORS[tab]}`}>
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-on-surface-variant mb-5 italic">{TAB_DESCRIPTIONS[activeTab]}</p>

      {/* Results */}
      {activeResults.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeResults.map((rec, idx) => {
            const c = rec.college;
            const isShortlisted = shortlist.includes(c.code);
            return (
              <div
                key={`${c.code}-${idx}`}
                className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-on-surface text-sm leading-tight flex-1">{c.name}</h3>
                  <button
                    onClick={() => toggleShortlist(c.code)}
                    className={`flex-shrink-0 ml-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                      isShortlisted ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant'
                    }`}
                    aria-label="Toggle shortlist"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isShortlisted ? 'bookmark' : 'bookmark_add'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-1 text-sm text-on-surface-variant mb-3">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {c.district}
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">{rec.branchCode}</span>
                  <span className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-1 rounded-full">{c.university}</span>
                  <span className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-1 rounded-full">{c.type}</span>
                  {c.averagePackageLpa != null && (
                    <span className="bg-secondary-container/40 text-on-secondary-container text-xs px-2.5 py-1 rounded-full">
                      {c.averagePackageLpa} LPA avg
                    </span>
                  )}
                </div>
                <div className="bg-surface-container-low rounded-lg p-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-outline mb-0.5">{year} Closing Rank</div>
                    <div className="text-lg font-bold text-on-surface">{rec.closingRank.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-outline mb-0.5">Your Rank</div>
                    <div className="text-lg font-bold text-primary">{rank.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">{rec.reason}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleShortlist(c.code)}
                    className={`flex-1 border py-2 rounded-lg text-sm font-medium transition-colors ${
                      isShortlisted ? 'border-primary bg-primary/5 text-primary' : 'border-primary text-primary hover:bg-primary/5'
                    }`}
                  >
                    {isShortlisted ? 'Shortlisted ✓' : 'Add to Shortlist'}
                  </button>
                  <button
                    onClick={() => navigate(`/app/colleges/${c.code}`)}
                    className="flex-1 bg-primary text-on-primary py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">
              {activeTab === 'dream' ? 'star' : activeTab === 'moderate' ? 'tune' : 'verified'}
            </span>
            <h3 className="text-on-surface font-semibold mb-2">No {activeTab} colleges found</h3>
            <p className="text-on-surface-variant text-sm">Try adjusting your rank, category, branch, or filters.</p>
          </div>
        )
      )}
    </div>
  );
}
