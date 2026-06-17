import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, rankOf } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const CutoffExplorer: React.FC = () => {
  const navigate = useNavigate();
  const { branchRows, districts, categories, genders, popularBranches, categoryLabel, year } = useData();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(user?.category ?? '');
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [selectedGender, setSelectedGender] = useState(user?.gender ?? '');
  const [selectedDistrict, setSelectedDistrict] = useState('All');

  // Sync when user session restores after a page refresh
  useEffect(() => {
    if (user) {
      setSelectedCategory(user.category);
      setSelectedGender(user.gender);
    }
  }, [user]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branchRows
      .filter(({ branch }) => !selectedBranch || branch.code === selectedBranch)
      .map(({ college, branch }) => {
        const closingRank = rankOf(branch, selectedCategory, selectedGender);
        if (closingRank === null) return null;
        if (q && !(college.name.toLowerCase().includes(q) || college.code.toLowerCase().includes(q))) {
          return null;
        }
        if (selectedDistrict !== 'All' && college.district !== selectedDistrict) return null;
        return { college, branch, closingRank, branchName: branch.shortName };
      })
      .filter(Boolean)
      .sort((a, b) => a!.closingRank - b!.closingRank) as NonNullable<{
        college: (typeof branchRows)[0]['college'];
        branch: (typeof branchRows)[0]['branch'];
        closingRank: number;
        branchName: string;
      }>[];
  }, [search, selectedCategory, selectedBranch, selectedGender, selectedDistrict]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-primary mb-1">Cutoff Explorer</h1>
        <p className="text-on-surface-variant">Explore TS EAMCET {year} final-phase closing ranks across colleges, branches, and categories.</p>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 lg:top-0 z-20 bg-background/90 backdrop-blur-md border-b border-outline-variant/30 px-6 lg:px-10 py-4">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-on-surface-variant mb-1 ml-1">College</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search college..."
                  className="w-full bg-surface-container-low rounded-lg py-2 pl-10 pr-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary/50 focus:bg-surface-container-lowest outline-none transition-all"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 ml-1">Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-surface-container-low rounded-lg py-2 px-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary/50 outline-none appearance-none cursor-pointer"
              >
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 ml-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="bg-surface-container-low rounded-lg py-2 px-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary/50 outline-none appearance-none cursor-pointer"
              >
                <option value="">All Branches</option>
                {popularBranches.map(b => <option key={b.code} value={b.code}>{b.shortName}</option>)}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 ml-1">Gender</label>
              <select
                value={selectedGender}
                onChange={e => setSelectedGender(e.target.value)}
                className="bg-surface-container-low rounded-lg py-2 px-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary/50 outline-none appearance-none cursor-pointer"
              >
                {genders.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1 ml-1">District</label>
              <select
                value={selectedDistrict}
                onChange={e => setSelectedDistrict(e.target.value)}
                className="bg-surface-container-low rounded-lg py-2 px-3 text-sm text-on-surface focus:ring-2 focus:ring-secondary/50 outline-none appearance-none cursor-pointer"
              >
                <option value="All">All Districts</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Reset */}
            <button
              onClick={() => { setSearch(''); setSelectedCategory(user?.category ?? ''); setSelectedBranch('CSE'); setSelectedGender(user?.gender ?? ''); setSelectedDistrict('All'); }}
              className="bg-surface-container text-on-surface-variant p-2 rounded-lg hover:bg-surface-container-high transition-colors"
              title="Reset filters"
            >
              <span className="material-symbols-outlined text-xl">filter_alt_off</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-6 lg:px-10 py-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-on-surface-variant">
            Showing <span className="font-semibold text-on-surface">{results.length}</span> results
          </p>
          <div className="text-xs text-on-surface-variant bg-secondary-container/30 text-on-secondary-container px-3 py-1 rounded-full">
            {year} · {categoryLabel(selectedCategory)} · {selectedGender} · {selectedBranch || 'All Branches'}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline mb-3 block">search_off</span>
            <p className="text-on-surface-variant">No cutoff data found for the selected filters.</p>
            <p className="text-sm text-outline mt-1">Try changing the branch or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map(({ college, branch, closingRank, branchName }) => (
              <div
                key={`${college.id}-${branch.code}`}
                className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] flex flex-col gap-3 hover:shadow-md transition-shadow group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center border border-outline-variant/30 shrink-0">
                      <span className="material-symbols-outlined text-outline">school</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-on-surface text-sm leading-tight line-clamp-2">{college.name}</h3>
                      <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {college.district}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="bg-secondary-container/40 text-on-secondary-container px-2 py-0.5 rounded-full text-xs">{branchName}</span>
                  <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full text-xs border border-outline-variant/30">{college.university}</span>
                  <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full text-xs border border-outline-variant/30">{college.type}</span>
                </div>

                <div className="flex justify-between items-end pt-2 border-t border-outline-variant/30 mt-auto">
                  <div>
                    <p className="text-xs text-on-surface-variant mb-0.5">Closing Rank ({year})</p>
                    <p className="text-2xl font-bold text-primary leading-tight">{closingRank.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/app/colleges/${college.id}`)}
                    className="text-secondary hover:text-on-secondary-container bg-secondary/10 hover:bg-secondary-container p-2 rounded-full transition-colors"
                  >
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-surface-dim border-t border-outline-variant px-6 lg:px-10 py-8 mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="font-bold text-primary">College Kurchi</div>
          <div className="text-xs text-on-surface-variant">© 2024 College Kurchi. Your steady guide to TS EAMCET counseling.</div>
        </div>
        <nav className="flex gap-4 text-sm text-on-surface-variant">
          <a href="#" className="hover:text-secondary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-secondary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-secondary transition-colors">Help</a>
        </nav>
      </footer>
    </div>
  );
};

export default CutoffExplorer;
