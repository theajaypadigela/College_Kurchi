import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const SHORTLIST_KEY = 'college-kurchi-shortlist';
const COMPARE_KEY = 'college-kurchi-compare';

const Shortlist: React.FC = () => {
  const navigate = useNavigate();
  const { colleges } = useData();
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(SHORTLIST_KEY);
    setShortlistIds(saved ? JSON.parse(saved) : []);
    const savedCompare = localStorage.getItem(COMPARE_KEY);
    setCompareIds(savedCompare ? JSON.parse(savedCompare) : []);
  }, []);

  const removeFromShortlist = (id: string) => {
    const updated = shortlistIds.filter(s => s !== id);
    setShortlistIds(updated);
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(updated));
  };

  const toggleCompare = (id: string) => {
    let updated: string[];
    if (compareIds.includes(id)) {
      updated = compareIds.filter(c => c !== id);
    } else if (compareIds.length < 3) {
      updated = [...compareIds, id];
    } else {
      alert('You can compare up to 3 colleges at a time.');
      return;
    }
    setCompareIds(updated);
    localStorage.setItem(COMPARE_KEY, JSON.stringify(updated));
  };

  const shortlistedColleges = colleges.filter(c => shortlistIds.includes(c.id));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 lg:px-10 pt-8 pb-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-1">My Shortlist</h1>
          <p className="text-on-surface-variant">
            {shortlistedColleges.length > 0
              ? `${shortlistedColleges.length} college${shortlistedColleges.length !== 1 ? 's' : ''} saved`
              : 'No colleges saved yet'}
          </p>
        </div>
        {shortlistedColleges.length >= 2 && (
          <div className="flex items-center gap-3">
            {compareIds.length >= 2 && (
              <button
                onClick={() => navigate('/app/compare')}
                className="bg-secondary text-on-secondary px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
              >
                <span className="material-symbols-outlined text-xl">compare_arrows</span>
                Compare Selected ({compareIds.length})
              </button>
            )}
            <button
              onClick={() => {
                const ids = shortlistedColleges.slice(0, 3).map(c => c.id);
                localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
                navigate('/app/compare');
              }}
              className="border border-secondary text-secondary px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-secondary-container transition-colors"
            >
              <span className="material-symbols-outlined text-xl">compare_arrows</span>
              Compare All
            </button>
          </div>
        )}
      </div>

      <div className="px-6 lg:px-10 pb-10">
        {shortlistedColleges.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-outline">bookmark</span>
            </div>
            <h2 className="text-xl font-semibold text-on-surface mb-2">No colleges shortlisted yet</h2>
            <p className="text-on-surface-variant mb-6 max-w-sm">
              Start exploring colleges and save your favourites here for easy comparison and tracking.
            </p>
            <Link
              to="/app/colleges"
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined">travel_explore</span>
              Explore Colleges
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shortlistedColleges.map(college => (
              <div
                key={college.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-5 shadow-[0px_4px_20px_rgba(30,58,138,0.05)] flex flex-col gap-4 hover:-translate-y-0.5 transition-transform"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-on-surface leading-tight">{college.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-surface-container text-on-surface-variant border border-outline-variant/40 px-2 py-0.5 rounded font-mono font-bold">{college.code}</span>
                      <span className="text-xs text-on-surface-variant flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {college.district}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromShortlist(college.id)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-error hover:bg-error-container/30 transition-colors"
                    title="Remove from shortlist"
                  >
                    <span className="material-symbols-outlined text-xl">bookmark_remove</span>
                  </button>
                </div>

                {/* Info chips */}
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded-full">{college.university}</span>
                  <span className="text-xs bg-surface-container text-on-surface-variant border border-outline-variant/30 px-2 py-0.5 rounded-full">{college.type}</span>
                </div>

                {/* Branch chips */}
                <div className="flex flex-wrap gap-1.5">
                  {college.branches.slice(0, 4).map(b => (
                    <span key={b.id} className="text-xs bg-primary-fixed/20 text-primary px-2 py-0.5 rounded-full font-medium">{b.shortName}</span>
                  ))}
                  {college.branches.length > 4 && (
                    <span className="text-xs text-outline px-1">+{college.branches.length - 4} more</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-outline-variant/20">
                  <Link
                    to={`/app/colleges/${college.id}`}
                    className="flex-1 bg-surface-container-low text-on-surface text-sm font-medium py-2 px-3 rounded-lg text-center hover:bg-surface-container transition-colors"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => toggleCompare(college.id)}
                    className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                      compareIds.includes(college.id)
                        ? 'bg-secondary-container text-on-secondary-container border-secondary/30'
                        : 'border-secondary text-secondary hover:bg-secondary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">compare_arrows</span>
                    {compareIds.includes(college.id) ? 'Selected' : 'Compare'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-surface-dim border-t border-outline-variant px-6 lg:px-10 py-8 mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="font-bold text-primary">College Kurchi</div>
          <div className="text-xs text-on-surface-variant">© 2024 College Kurchi. Your steady guide to TS EAMCET counseling.</div>
        </div>
        <nav className="flex gap-4 text-sm text-on-surface-variant">
          <a href="#" className="hover:text-secondary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-secondary transition-colors">Terms of Service</a>
        </nav>
      </footer>
    </div>
  );
};

export default Shortlist;
