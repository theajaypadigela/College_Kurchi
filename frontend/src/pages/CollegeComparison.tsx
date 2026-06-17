import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, rankOf } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { College } from '../api/types';
import { postCompare } from '../api';

const STORAGE_KEY = 'college-kurchi-compare';
const SHORTLIST_KEY = 'college-kurchi-shortlist';

function getStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

function saveIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function getShortlist(): string[] {
  try {
    const raw = localStorage.getItem(SHORTLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveShortlist(ids: string[]): void {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(ids));
}

export default function CollegeComparison(): React.ReactElement {
  const navigate = useNavigate();
  const { colleges, year } = useData();
  const { user } = useAuth();

  // Use user's category & gender for all rank lookups; fall back to empty string so
  // the table shows N/A rather than silently showing the wrong category's data.
  const userCategory = user?.category ?? '';
  const userGender = user?.gender ?? '';
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<string[]>(getStoredIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedColleges = selectedCollegeIds
    .map(id => colleges.find(c => c.id === id))
    .filter((c): c is College => Boolean(c));

  // Fetch the AI comparison summary whenever the selection changes (>= 2 colleges).
  useEffect(() => {
    if (selectedCollegeIds.length < 2) {
      setAiSummary('');
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setAiSummary('');
    postCompare({ codes: selectedCollegeIds })
      .then(res => !cancelled && setAiSummary(res.aiSummary))
      .catch(() => !cancelled && setAiSummary(''))
      .finally(() => !cancelled && setSummaryLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollegeIds.join(',')]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function getLatestCutoff(
    collegeId: string,
    branchShortName: string,
    category = userCategory,
    gender = userGender
  ): number | null {
    const college = colleges.find(c => c.id === collegeId);
    if (!college) return null;
    const collegeBranch = college.branches.find(b => b.shortName === branchShortName);
    if (!collegeBranch) return null;
    return rankOf(collegeBranch, category, gender);
  }

  function addCollege(id: string): void {
    if (selectedCollegeIds.includes(id) || selectedCollegeIds.length >= 3) return;
    const updated = [...selectedCollegeIds, id];
    setSelectedCollegeIds(updated);
    saveIds(updated);
    setSearchQuery('');
    setShowDropdown(false);
  }

  function removeCollege(id: string): void {
    const updated = selectedCollegeIds.filter(cid => cid !== id);
    setSelectedCollegeIds(updated);
    saveIds(updated);
  }

  function addToShortlist(id: string): void {
    const current = getShortlist();
    if (!current.includes(id)) {
      saveShortlist([...current, id]);
    }
  }

  const filteredColleges = colleges
    .filter(c => {
      if (selectedCollegeIds.includes(c.id)) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    })
    .slice(0, 8);

  // For rank highlight: find lowest rank (most competitive = smallest number) across selected colleges per branch row
  function getLowestRank(branchShortName: string): number | null {
    const ranks = selectedColleges
      .map(c => getLatestCutoff(c.id, branchShortName))
      .filter((r): r is number => r !== null);
    return ranks.length > 0 ? Math.min(...ranks) : null;
  }

  const lowestCSE = getLowestRank('CSE');
  const lowestECE = getLowestRank('ECE');
  const lowestIT = getLowestRank('IT');

  type RowDef = {
    label: string;
    render: (college: College) => React.ReactNode;
  };

  const rows: RowDef[] = [
    {
      label: 'College Name',
      render: (c) => <span className="font-medium text-on-surface text-sm">{c.name}</span>,
    },
    {
      label: 'Code',
      render: (c) => (
        <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
          {c.code}
        </span>
      ),
    },
    {
      label: 'District',
      render: (c) => (
        <span className="flex items-center gap-1 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-base">location_on</span>
          {c.district}
        </span>
      ),
    },
    {
      label: 'University',
      render: (c) => (
        <span className="inline-block bg-secondary/10 text-secondary text-xs font-semibold px-2.5 py-1 rounded-full">
          {c.university}
        </span>
      ),
    },
    {
      label: 'Type',
      render: (c) => (
        <span className="text-sm text-on-surface">{c.type}</span>
      ),
    },
    {
      label: 'Branches',
      render: (c) => (
        <span className="text-sm text-on-surface-variant">{c.branches.map(b => b.shortName).join(', ')}</span>
      ),
    },
    {
      label: `CSE ${userCategory} ${userGender} ${year}`,
      render: (c) => {
        const rank = getLatestCutoff(c.id, 'CSE');
        const isLowest = rank !== null && lowestCSE !== null && rank === lowestCSE;
        return (
          <span
            className={`text-sm font-semibold ${
              rank === null
                ? 'text-outline'
                : isLowest
                ? 'text-green-600'
                : 'text-on-surface'
            }`}
          >
            {rank === null ? 'N/A' : rank.toLocaleString()}
          </span>
        );
      },
    },
    {
      label: `ECE ${userCategory} ${userGender} ${year}`,
      render: (c) => {
        const rank = getLatestCutoff(c.id, 'ECE');
        const isLowest = rank !== null && lowestECE !== null && rank === lowestECE;
        return (
          <span
            className={`text-sm font-semibold ${
              rank === null
                ? 'text-outline'
                : isLowest
                ? 'text-green-600'
                : 'text-on-surface'
            }`}
          >
            {rank === null ? 'N/A' : rank.toLocaleString()}
          </span>
        );
      },
    },
    {
      label: `IT ${userCategory} ${userGender} ${year}`,
      render: (c) => {
        const rank = getLatestCutoff(c.id, 'IT');
        const isLowest = rank !== null && lowestIT !== null && rank === lowestIT;
        return (
          <span
            className={`text-sm font-semibold ${
              rank === null
                ? 'text-outline'
                : isLowest
                ? 'text-green-600'
                : 'text-on-surface'
            }`}
          >
            {rank === null ? 'N/A' : rank.toLocaleString()}
          </span>
        );
      },
    },
    {
      label: 'Fee / Year',
      render: (c) => (
        <span className="text-sm font-semibold text-on-surface">
          {c.feePerYear != null ? `₹${c.feePerYear.toLocaleString('en-IN')}` : 'N/A'}
        </span>
      ),
    },
    {
      label: 'Avg Package',
      render: (c) => (
        <span className="text-sm font-semibold text-on-surface">
          {c.averagePackageLpa != null ? `${c.averagePackageLpa} LPA` : 'N/A'}
        </span>
      ),
    },
    {
      label: 'Highest Package',
      render: (c) => (
        <span className="text-sm font-semibold text-on-surface">
          {c.highestPackageLpa != null ? `${c.highestPackageLpa} LPA` : 'N/A'}
        </span>
      ),
    },
    {
      label: 'Top Recruiters',
      render: (c) => (
        <span className="text-sm text-on-surface-variant">
          {c.topRecruiters.length > 0 ? c.topRecruiters.slice(0, 4).join(', ') : 'N/A'}
        </span>
      ),
    },
  ];

  // Empty placeholder columns to fill up to 3
  const emptySlots = 3 - selectedColleges.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface">College Comparison</h1>
        <div className="text-sm text-on-surface-variant">Compare up to 3 colleges side-by-side</div>
      </div>

      {/* Add college search */}
      {selectedCollegeIds.length < 3 && (
        <div className="relative mb-6" ref={dropdownRef as React.RefObject<HTMLDivElement>}>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search and add a college to compare..."
              className="w-full max-w-lg pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl bg-white text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {showDropdown && filteredColleges.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-lg bg-white rounded-lg shadow-lg border border-outline-variant/50 z-50 overflow-hidden">
              {filteredColleges.map(college => (
                <button
                  key={college.id}
                  onMouseDown={() => addCollege(college.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low text-left transition-colors"
                >
                  <span className="material-symbols-outlined text-outline text-lg">school</span>
                  <div>
                    <div className="text-sm font-medium text-on-surface">{college.name}</div>
                    <div className="text-xs text-on-surface-variant">{college.code} · {college.district}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchQuery && filteredColleges.length === 0 && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-lg bg-white rounded-lg shadow-lg border border-outline-variant/50 z-50 px-4 py-3 text-sm text-on-surface-variant">
              No colleges found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedCollegeIds.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">compare_arrows</span>
          <h3 className="text-lg font-semibold text-on-surface mb-2">No colleges to compare</h3>
          <p className="text-on-surface-variant text-sm">Add up to 3 colleges to compare side by side</p>
        </div>
      )}

      {/* AI summary */}
      {selectedColleges.length >= 2 && (
        <div className="mb-6 rounded-xl border border-secondary/30 bg-secondary-container/20 p-5 shadow-[0px_4px_20px_rgba(30,58,138,0.05)]">
          <h3 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">auto_awesome</span>
            AI Comparison Summary
          </h3>
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              Analyzing differences…
            </div>
          ) : aiSummary ? (
            <div className="text-sm text-on-surface-variant leading-relaxed space-y-1">
              {aiSummary.split('\n').filter(Boolean).map((line, i) => (
                <p key={i}>
                  {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={j} className="text-on-surface">{part.slice(2, -2)}</strong>
                    ) : (
                      <span key={j}>{part}</span>
                    )
                  )}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Add two or more colleges to generate a summary.</p>
          )}
        </div>
      )}

      {/* Comparison table */}
      {selectedColleges.length > 0 && (
        <div className="rounded-xl shadow-[0px_4px_20px_rgba(30,58,138,0.05)] border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {/* Criteria column header */}
                  <th className="text-left p-4 w-48 bg-surface-container-low border-b border-outline-variant/20 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Criteria
                  </th>

                  {/* Selected college headers */}
                  {selectedColleges.map(college => (
                    <th
                      key={college.id}
                      className="p-4 text-left min-w-[200px] bg-white border-b border-outline-variant/20"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-on-surface text-sm leading-tight">{college.name}</span>
                        <button
                          onClick={() => removeCollege(college.id)}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                          aria-label={`Remove ${college.name}`}
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                      <button
                        onClick={() => addToShortlist(college.id)}
                        className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">bookmark_add</span>
                        Add to Shortlist
                      </button>
                    </th>
                  ))}

                  {/* Empty slot headers */}
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <th
                      key={`empty-header-${i}`}
                      className="p-4 min-w-[200px] bg-surface-container-lowest border-b border-outline-variant/20"
                    >
                      <div className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-outline-variant/40 rounded-xl">
                        <span className="material-symbols-outlined text-outline/40 text-lg">add_circle</span>
                        <span className="text-xs text-outline/60 mt-1">Add College</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.label}
                    className={rowIdx % 2 === 0 ? 'bg-surface-container-low' : 'bg-white'}
                  >
                    <td className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wide whitespace-nowrap border-r border-outline-variant/10">
                      {row.label}
                    </td>
                    {selectedColleges.map(college => (
                      <td key={college.id} className="p-4 border-r border-outline-variant/10">
                        {row.render(college)}
                      </td>
                    ))}
                    {Array.from({ length: emptySlots }).map((_, i) => (
                      <td key={`empty-cell-${i}`} className="p-4 border-r border-outline-variant/10" />
                    ))}
                  </tr>
                ))}

                {/* View Details row */}
                <tr className="bg-surface-container-low">
                  <td className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wide border-r border-outline-variant/10" />
                  {selectedColleges.map(college => (
                    <td key={college.id} className="p-4 border-r border-outline-variant/10">
                      <button
                        onClick={() => navigate(`/app/colleges/${college.id}`)}
                        className="w-full bg-primary text-on-primary py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        View Details
                      </button>
                    </td>
                  ))}
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <td key={`empty-btn-${i}`} className="p-4 border-r border-outline-variant/10" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {selectedColleges.length > 0 && (
        <p className="text-xs text-on-surface-variant mt-3 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />
          Green rank = most competitive (lowest closing rank) among compared colleges
        </p>
      )}
    </div>
  );
}
