import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const COMPARE_KEY = 'college-kurchi-compare';
const SHORTLIST_KEY = 'college-kurchi-shortlist';

function loadFromStorage(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

const CollegeExplorer: React.FC = () => {
  const navigate = useNavigate();
  const { colleges, districts, collegeTypes, popularBranches } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const [compareIds, setCompareIds] = useState<string[]>(() => loadFromStorage(COMPARE_KEY));
  const [shortlistIds, setShortlistIds] = useState<string[]>(() => loadFromStorage(SHORTLIST_KEY));

  const filteredColleges = useMemo(() => {
    return colleges.filter((college) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        college.name.toLowerCase().includes(q) ||
        college.code.toLowerCase().includes(q) ||
        college.district.toLowerCase().includes(q);

      const matchesBranch =
        !selectedBranch ||
        college.branches.some((b) => b.code === selectedBranch);

      const matchesDistrict =
        !selectedDistrict || college.district === selectedDistrict;

      const matchesType =
        !selectedType || college.type === selectedType;

      return matchesSearch && matchesBranch && matchesDistrict && matchesType;
    });
  }, [searchQuery, selectedBranch, selectedDistrict, selectedType]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedBranch('');
    setSelectedDistrict('');
    setSelectedType('');
  };

  const hasActiveFilters =
    searchQuery || selectedBranch || selectedDistrict || selectedType;

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else if (prev.length >= 3) {
        next = prev; // max 3
      } else {
        next = [...prev, id];
      }
      saveToStorage(COMPARE_KEY, next);
      return next;
    });
  };

  const toggleShortlist = (id: string) => {
    setShortlistIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveToStorage(SHORTLIST_KEY, next);
      return next;
    });
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-5">
        <h1 className="text-2xl font-bold text-on-surface">College Explorer</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Browse and filter {colleges.length} engineering colleges across Telangana (TS EAMCET 2025)
        </p>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 lg:top-0 z-10 bg-background border-b border-outline-variant/30 px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colleges..."
              className="w-full bg-white border border-outline-variant/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Branch filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-white border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="">All Branches</option>
            {popularBranches.map((b) => (
              <option key={b.code} value={b.code}>
                {b.shortName}
              </option>
            ))}
          </select>

          {/* District filter */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-white border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="">All Types</option>
            {collegeTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-outline-variant/30 bg-white text-on-surface-variant text-sm hover:bg-surface-container transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-base">close</span>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results count + compare bar */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
        <p className="text-on-surface-variant text-sm">
          Showing{' '}
          <span className="font-semibold text-on-surface">{filteredColleges.length}</span> college
          {filteredColleges.length !== 1 ? 's' : ''}
        </p>
        {compareIds.length > 0 && (
          <button
            onClick={() => navigate('/app/compare')}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">compare_arrows</span>
            Compare ({compareIds.length})
          </button>
        )}
      </div>

      {/* College grid */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-8">
        {filteredColleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-outline text-6xl mb-4">
              search_off
            </span>
            <h3 className="font-bold text-on-surface text-lg mb-2">No colleges found</h3>
            <p className="text-on-surface-variant text-sm mb-4">
              Try adjusting your filters to see more results.
            </p>
            <button
              onClick={resetFilters}
              className="text-primary font-semibold text-sm hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredColleges.map((college) => {
              const isShortlisted = shortlistIds.includes(college.id);
              const isInCompare = compareIds.includes(college.id);
              const canAddCompare = compareIds.length < 3 || isInCompare;
              const displayBranches = college.branches.slice(0, 4);
              const extraBranches = college.branches.length - 4;

              return (
                <div
                  key={college.id}
                  className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 bg-white p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  {/* Top row: name + code badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-bold text-on-surface text-base leading-tight cursor-pointer hover:text-primary transition-colors flex-1"
                      onClick={() => navigate(`/app/colleges/${college.id}`)}
                    >
                      {college.name}
                    </h3>
                    <span className="flex-shrink-0 bg-surface-container text-on-surface-variant text-xs font-semibold px-2 py-1 rounded-md">
                      {college.code}
                    </span>
                  </div>

                  {/* District */}
                  <div className="flex items-center gap-1.5 text-on-surface-variant text-sm">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    {college.district}
                  </div>

                  {/* University + Type badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                      {college.university}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${typeColor(college.type)}`}
                    >
                      {college.type}
                    </span>
                  </div>

                  {/* Branch chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {displayBranches.map((b) => (
                      <span
                        key={b.id}
                        className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-1 rounded-full"
                      >
                        {b.shortName}
                      </span>
                    ))}
                    {extraBranches > 0 && (
                      <span className="bg-surface-container text-on-surface-variant text-xs px-2.5 py-1 rounded-full">
                        +{extraBranches} more
                      </span>
                    )}
                  </div>

                  {/* Fees & placement stats */}
                  {(college.feePerYear != null || college.averagePackageLpa != null) && (
                    <div className="flex items-center gap-4 text-xs">
                      {college.feePerYear != null && (
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm text-primary">payments</span>
                          ₹{(college.feePerYear / 1000).toLocaleString('en-IN')}k/yr
                        </div>
                      )}
                      {college.averagePackageLpa != null && (
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm text-secondary">trending_up</span>
                          {college.averagePackageLpa} LPA avg
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/20">
                    <button
                      onClick={() => navigate(`/app/colleges/${college.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      View Details
                    </button>

                    <button
                      onClick={() => toggleShortlist(college.id)}
                      title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                        isShortlisted
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-primary/5 hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {isShortlisted ? 'bookmark' : 'bookmark_border'}
                      </span>
                    </button>

                    <button
                      onClick={() => toggleCompare(college.id)}
                      disabled={!canAddCompare}
                      title={
                        isInCompare
                          ? 'Remove from compare'
                          : compareIds.length >= 3
                          ? 'Max 3 colleges in compare'
                          : 'Add to compare'
                      }
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isInCompare
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-secondary/5 hover:text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">compare_arrows</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollegeExplorer;
