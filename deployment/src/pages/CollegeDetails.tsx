import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData, rankOf } from '../context/DataContext';

const SHORTLIST_KEY = 'college-kurchi-shortlist';

function loadShortlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveShortlist(ids: string[]) {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(ids));
}

type Tab = 'branches' | 'about';

const typeColor = (type: string) => {
  switch (type) {
    case 'Government':
      return 'bg-green-100 text-green-800';
    case 'University':
      return 'bg-blue-100 text-blue-800';
    case 'Self-Finance':
      return 'bg-amber-100 text-amber-800';
    case 'Private':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
};

const formatRank = (rank: number | null): string =>
  rank === null ? 'N/A' : rank.toLocaleString('en-IN');

const formatINR = (value: number | null): string =>
  value === null ? 'N/A' : `₹${value.toLocaleString('en-IN')}`;

const CollegeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCollegeById, categories, genders, categoryLabel, year } = useData();

  const college = getCollegeById(id);

  const [activeTab, setActiveTab] = useState<Tab>('branches');
  const [selectedCategory, setSelectedCategory] = useState<string>('OC');
  const [selectedGender, setSelectedGender] = useState<string>('Boys');
  const [shortlistIds, setShortlistIds] = useState<string[]>(loadShortlist);

  if (!college) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-outline text-6xl">error_outline</span>
        <h2 className="text-xl font-bold text-on-surface">College not found</h2>
        <p className="text-on-surface-variant text-sm">
          The college you're looking for doesn't exist or has been removed.
        </p>
        <button
          onClick={() => navigate('/app/colleges')}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Back to Explorer
        </button>
      </div>
    );
  }

  const isShortlisted = shortlistIds.includes(college.id);

  const toggleShortlist = () => {
    setShortlistIds((prev) => {
      const next = prev.includes(college.id)
        ? prev.filter((x) => x !== college.id)
        : [...prev, college.id];
      saveShortlist(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/30">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-sm mb-4 transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Explorer
          </button>

          {/* College name row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-xl lg:text-2xl font-bold text-on-surface leading-tight">
                  {college.name}
                </h1>
                <span className="bg-surface-container text-on-surface-variant text-sm font-semibold px-2.5 py-1 rounded-md flex-shrink-0">
                  {college.code}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center flex-wrap gap-3">
                <div className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {college.place ? `${college.place}, ` : ''}{college.district}
                </div>
                <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                  {college.university}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${typeColor(college.type)}`}
                >
                  {college.type}
                </span>
                {college.coEducation === 'GIRLS' && (
                  <span className="bg-pink-100 text-pink-800 text-xs font-medium px-2.5 py-1 rounded-full">
                    Girls
                  </span>
                )}
              </div>
            </div>

            {/* Shortlist button */}
            <button
              onClick={toggleShortlist}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors flex-shrink-0 ${
                isShortlisted
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-primary/5 hover:border-primary/30 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {isShortlisted ? 'bookmark' : 'bookmark_border'}
              </span>
              {isShortlisted ? 'Shortlisted' : 'Shortlist'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'branches'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Branches &amp; Cutoffs
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'about'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              About College
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
        {activeTab === 'branches' && (
          <div>
            {/* Filter row */}
            <div className="flex flex-wrap gap-3 mb-6 items-end">
              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant font-medium">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-white border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant font-medium">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="bg-white border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  {genders.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-on-surface-variant bg-secondary-container/30 text-on-secondary-container px-3 py-1.5 rounded-full ml-auto">
                {year} Final Phase · {categoryLabel(selectedCategory)} · {selectedGender}
              </div>
            </div>

            {/* Cutoff table */}
            <div className="rounded-xl border border-outline-variant/30 bg-white overflow-hidden shadow-[0px_4px_20px_rgba(30,58,138,0.05)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant/20">
                      <th className="text-left px-5 py-3.5 text-sm font-semibold text-on-surface">
                        Branch
                      </th>
                      <th className="text-center px-4 py-3.5 text-sm font-semibold text-on-surface">
                        Closing Rank ({categoryLabel(selectedCategory)} {selectedGender})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {college.branches.map((branch) => {
                      const rank = rankOf(branch, selectedCategory, selectedGender);
                      return (
                        <tr key={branch.id} className="hover:bg-surface-container/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-on-surface text-sm">
                              {branch.shortName}
                            </div>
                            <div className="text-on-surface-variant text-xs mt-0.5">
                              {branch.name}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {rank !== null ? (
                              <span className="text-sm font-semibold text-on-surface">
                                {formatRank(rank)}
                              </span>
                            ) : (
                              <span className="text-sm text-outline">Not offered</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note */}
            <div className="mt-4 flex items-center flex-wrap gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-sm">info</span>
              <span>
                Closing ranks are the last ranks admitted in the {year} TS EAMCET final phase.
                A lower closing rank means tougher competition.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-5">
            {/* Info card */}
            <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-secondary px-6 py-5 text-on-primary">
                <div className="text-2xl font-bold">{college.name}</div>
                <div className="text-on-primary/70 text-sm mt-1">{college.code}</div>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">
                    Location
                  </div>
                  <div className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">
                      location_on
                    </span>
                    {college.place ? `${college.place}, ` : ''}{college.district}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">
                    Affiliating University
                  </div>
                  <div className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">
                      account_balance
                    </span>
                    {college.university}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">
                    College Type
                  </div>
                  <div className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">school</span>
                    {college.type}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">
                    Total Branches
                  </div>
                  <div className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">
                      category
                    </span>
                    {college.branches.length} branches
                  </div>
                </div>
              </div>
            </div>

            {/* Fees & Placements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Fees */}
              <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
                <h3 className="font-bold text-on-surface text-base mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">payments</span>
                  Fees
                </h3>
                {college.feePerYear != null ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-on-surface-variant">Tuition fee / year</span>
                      <span className="text-sm font-semibold text-on-surface">
                        {formatINR(college.feePerYear)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-on-surface-variant">Total (4 years)</span>
                      <span className="text-sm font-semibold text-on-surface">
                        {formatINR(college.totalFees)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-outline">Fee information not available.</p>
                )}
              </div>

              {/* Placements */}
              <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
                <h3 className="font-bold text-on-surface text-base mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">trending_up</span>
                  Placements
                </h3>
                {college.averagePackageLpa != null || college.highestPackageLpa != null ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-on-surface-variant">Highest package</span>
                      <span className="text-sm font-semibold text-on-surface">
                        {college.highestPackageLpa != null ? `${college.highestPackageLpa} LPA` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-on-surface-variant">Average package</span>
                      <span className="text-sm font-semibold text-on-surface">
                        {college.averagePackageLpa != null ? `${college.averagePackageLpa} LPA` : 'N/A'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-outline">Placement information not available.</p>
                )}
              </div>
            </div>

            {/* Top recruiters */}
            {college.topRecruiters.length > 0 && (
              <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
                <h3 className="font-bold text-on-surface text-base mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">groups</span>
                  Top Recruiters
                </h3>
                <div className="flex flex-wrap gap-2">
                  {college.topRecruiters.map((r) => (
                    <span
                      key={r}
                      className="bg-surface-container text-on-surface-variant text-xs font-medium px-3 py-1.5 rounded-full"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Branches available */}
            <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
              <h3 className="font-bold text-on-surface text-base mb-4">Available Branches</h3>
              <div className="space-y-3">
                {college.branches.map((branch) => {
                  const ocRank = rankOf(branch, 'OC', 'Boys');
                  return (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between py-2.5 border-b border-outline-variant/10 last:border-0"
                    >
                      <div>
                        <div className="font-semibold text-on-surface text-sm">
                          {branch.shortName}
                        </div>
                        <div className="text-on-surface-variant text-xs mt-0.5">{branch.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-on-surface">
                          {ocRank !== null ? ocRank.toLocaleString('en-IN') : '—'}
                        </div>
                        <div className="text-on-surface-variant text-xs">OC Boys cutoff</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-outline-variant/30 bg-white shadow-[0px_4px_20px_rgba(30,58,138,0.05)] p-6">
              <h3 className="font-bold text-on-surface text-base mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('branches')}
                  className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 text-primary px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-base">trending_up</span>
                  View Cutoffs
                </button>
                <button
                  onClick={toggleShortlist}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isShortlisted
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isShortlisted ? 'bookmark' : 'bookmark_border'}
                  </span>
                  {isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
                </button>
                <button
                  onClick={() => navigate('/app/predictor')}
                  className="flex items-center gap-2 bg-surface-container hover:bg-secondary/10 text-on-surface-variant hover:text-secondary px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-base">analytics</span>
                  Predict Admission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollegeDetails;
