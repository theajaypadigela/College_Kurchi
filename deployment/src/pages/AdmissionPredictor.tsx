import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { postPredict } from '../api';
import type { PredictResponse } from '../api/types';
import MultiSelect from '../components/MultiSelect';
import type { MultiSelectOption } from '../components/MultiSelect';

const AdmissionPredictor: React.FC = () => {
  const navigate = useNavigate();
  const { colleges, categories, genders, branchOptions, year } = useData();
  const { user } = useAuth();

  // Pre-fill from user profile
  const [rank, setRank] = useState<number>(user?.rank ?? 0);
  const [category, setCategory] = useState(user?.category ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');

  // Sync when user session restores after a page refresh
  useEffect(() => {
    if (user) {
      setRank(user.rank);
      setCategory(user.category);
      setGender(user.gender);
    }
  }, [user]);

  // MultiSelect state: arrays of selected values
  const [selectedBranches, setSelectedBranches] = useState<string[]>(['CSE']);
  const [selectedCollegeCodes, setSelectedCollegeCodes] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictResponse[]>([]);

  // Build option lists for MultiSelect
  const branchSelectOptions: MultiSelectOption[] = useMemo(
    () => branchOptions.map(b => ({ value: b.code, label: b.shortName ?? b.name })),
    [branchOptions]
  );

  const collegeSelectOptions: MultiSelectOption[] = useMemo(
    () => colleges.map(c => ({ value: c.id, label: c.name })),
    [colleges]
  );

  const handlePredict = async () => {
    if (selectedBranches.length === 0) {
      setError('Select at least one branch');
      return;
    }
    setLoading(true);
    setError(null);
    setPredictions([]);

    // Build cartesian: each branch × each target college (or no college)
    const targets: { branch: string; collegeCode: string | null }[] = [];
    if (selectedCollegeCodes.length === 0) {
      selectedBranches.forEach(b => targets.push({ branch: b, collegeCode: null }));
    } else {
      selectedBranches.forEach(b =>
        selectedCollegeCodes.forEach(c => targets.push({ branch: b, collegeCode: c }))
      );
    }

    try {
      const results = await Promise.all(
        targets.map(t =>
          postPredict({ rank, category, gender, branch: t.branch, collegeCode: t.collegeCode })
        )
      );
      setPredictions(results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  // For single-prediction display (legacy detail view)
  const primary = predictions[0] ?? null;
  const probability = primary?.probability ?? 0;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (probability / 100) * circumference;
  const meterColor =
    probability >= 70 ? '#006a61' : probability >= 40 ? '#f59e0b' : '#ba1a1a';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-on-surface mb-2">Admission Predictor</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        Get AI-powered admission probability based on your rank and preferences
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input form — 5 cols */}
        <div className="lg:col-span-5">
          <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
            <h2 className="font-semibold text-on-surface text-lg mb-1">Your Details</h2>
            {user && (
              <p className="text-xs text-outline mb-5">
                Pre-filled from your profile — edit as needed
              </p>
            )}
            <div className="space-y-4">
              {/* Rank input */}
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                  Your TS EAMCET Rank
                </label>
                <input
                  type="number"
                  value={rank}
                  onChange={e => setRank(Number(e.target.value))}
                  min={1}
                  max={200000}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-lg font-semibold"
                />
              </div>

              {/* Category select */}
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender select */}
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  {genders.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch MultiSelect */}
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                  Branch
                </label>
                <MultiSelect
                  options={branchSelectOptions}
                  value={selectedBranches}
                  onChange={setSelectedBranches}
                  placeholder="Select branches…"
                  searchPlaceholder="Search branch…"
                />
              </div>

              {/* Target College MultiSelect (optional) */}
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1.5">
                  Target College{' '}
                  <span className="font-normal text-outline">(Optional)</span>
                </label>
                <MultiSelect
                  options={collegeSelectOptions}
                  value={selectedCollegeCodes}
                  onChange={setSelectedCollegeCodes}
                  placeholder="Any college…"
                  searchPlaceholder="Search college…"
                />
              </div>

              {/* Predict button */}
              <button
                onClick={handlePredict}
                disabled={loading || selectedBranches.length === 0}
                className="w-full bg-primary text-on-primary rounded-xl py-3.5 font-semibold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>
                  {loading ? 'progress_activity' : 'analytics'}
                </span>
                {loading ? 'Predicting…' : `Predict Chances${selectedBranches.length > 1 ? ` (${selectedBranches.length} branches)` : ''}`}
              </button>
              {error && <p className="text-error text-sm mt-2">{error}</p>}
            </div>
          </div>
        </div>

        {/* Right: Results — 7 cols */}
        <div className="lg:col-span-7">
          {predictions.length === 0 ? (
            <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-8 flex flex-col items-center justify-center min-h-80 text-center">
              <span className="material-symbols-outlined text-7xl text-outline/30 mb-4">analytics</span>
              <h3 className="text-xl font-semibold text-on-surface mb-2">Ready to Predict</h3>
              <p className="text-on-surface-variant text-sm max-w-xs">
                Select branches (and optionally target colleges) on the left, then click "Predict Chances"
              </p>
            </div>
          ) : predictions.length === 1 ? (
            /* Single-result detailed view */
            <div className="space-y-4">
              {/* Main probability card */}
              <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-on-surface text-lg">Admission Probability</h2>
                  <span
                    className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                      primary!.classification === 'HIGH'
                        ? 'bg-green-50 text-green-700'
                        : primary!.classification === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {primary!.classification} CHANCE
                  </span>
                </div>
                <div className="flex items-center gap-8">
                  <div className="flex-shrink-0">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r={radius} fill="none" stroke="#eceef0" strokeWidth="12" />
                      <circle
                        cx="70" cy="70" r={radius} fill="none"
                        stroke={meterColor} strokeWidth="12"
                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round" transform="rotate(-90 70 70)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                      />
                      <text x="70" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill={meterColor}>
                        {probability}%
                      </text>
                      <text x="70" y="85" textAnchor="middle" fontSize="11" fill="#757682">Probability</text>
                    </svg>
                  </div>
                  <div className="flex-1">
                    {primary!.collegeName && (
                      <div className="mb-3">
                        <div className="text-xs text-outline">Target College</div>
                        <div className="font-semibold text-on-surface text-sm">{primary!.collegeName}</div>
                      </div>
                    )}
                    {primary!.cutoffRank !== null && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <div className="text-xs text-outline">Your Rank</div>
                          <div className="text-xl font-bold text-primary">{rank.toLocaleString()}</div>
                        </div>
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <div className="text-xs text-outline">Cutoff {year}</div>
                          <div className="text-xl font-bold text-on-surface">{primary!.cutoffRank.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                    {!primary!.collegeName && (
                      <div className="bg-surface-container-low rounded-lg p-3">
                        <div className="text-xs text-outline">Your Rank</div>
                        <div className="text-xl font-bold text-primary">{rank.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Why card */}
              <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-5">
                <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  Why this result?
                </h3>
                <div className="text-sm text-on-surface-variant leading-relaxed">{primary!.reasoning}</div>
              </div>

              {/* Safe alternatives */}
              {primary!.safeAlternatives.length > 0 && (
                <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-5">
                  <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">verified</span>
                    Safe Alternatives
                  </h3>
                  <div className="space-y-2">
                    {primary!.safeAlternatives.map((alt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                        <div>
                          <div className="font-medium text-on-surface text-sm">{alt.name}</div>
                          <div className="text-xs text-outline">Cutoff: {alt.closingRank.toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => navigate(`/app/colleges/${alt.code}`)}
                          className="text-primary text-xs font-semibold hover:underline"
                        >
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Multi-result summary table */
            <div className="space-y-4">
              <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
                <h2 className="font-semibold text-on-surface text-lg mb-4">
                  Prediction Results — {predictions.length} combinations
                </h2>
                <div className="space-y-3">
                  {predictions.map((pred, idx) => {
                    const col =
                      pred.probability >= 70 ? 'bg-green-50 text-green-700 border-green-200'
                      : pred.probability >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200';
                    return (
                      <div key={idx} className={`rounded-lg border p-4 ${col}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm">
                              {pred.branch}
                              {pred.collegeName ? ` @ ${pred.collegeName}` : ' — Any College'}
                            </div>
                            <div className="text-xs mt-0.5 opacity-80">{pred.reasoning}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-2xl font-bold">{pred.probability}%</div>
                            <div className="text-xs font-semibold">{pred.classification}</div>
                          </div>
                        </div>
                        {pred.cutoffRank !== null && (
                          <div className="mt-2 text-xs opacity-80">
                            Cutoff {year}: {pred.cutoffRank.toLocaleString()} | Your rank: {rank.toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Show safe alternatives from first result */}
              {predictions[0]?.safeAlternatives.length > 0 && (
                <div className="rounded-xl bg-white border border-outline-variant/30 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-5">
                  <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">verified</span>
                    Safe Alternatives
                  </h3>
                  <div className="space-y-2">
                    {predictions[0].safeAlternatives.map((alt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
                        <div>
                          <div className="font-medium text-on-surface text-sm">{alt.name}</div>
                          <div className="text-xs text-outline">Cutoff: {alt.closingRank.toLocaleString()}</div>
                        </div>
                        <button onClick={() => navigate(`/app/colleges/${alt.code}`)} className="text-primary text-xs font-semibold hover:underline">
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdmissionPredictor;
