import React, { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelected?: number;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select options…',
  searchPlaceholder = 'Search…',
  maxSelected,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    o.value.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v));
    } else {
      if (maxSelected && value.length >= maxSelected) return;
      onChange([...value, v]);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedLabels = value.map(v => options.find(o => o.value === v)?.label ?? v);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(p => !p); }}
        className={`w-full min-h-[42px] border rounded-lg px-3 py-2 text-left bg-white flex items-center gap-2 transition-colors
          ${open ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary/60'}
          focus:outline-none`}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-h-[24px]">
          {selectedLabels.length === 0 ? (
            <span className="text-outline text-sm self-center">{placeholder}</span>
          ) : (
            selectedLabels.map((label, i) => (
              <span
                key={value[i]}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full"
              >
                {label}
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); toggle(value[i]); }}
                  className="hover:text-error cursor-pointer leading-none"
                >
                  ×
                </span>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {value.length > 0 && (
            <span
              role="button"
              onClick={clear}
              className="material-symbols-outlined text-base text-outline hover:text-error cursor-pointer"
              title="Clear all"
            >
              close
            </span>
          )}
          <span className={`material-symbols-outlined text-base text-outline transition-transform ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-outline-variant rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-outline-variant/30">
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-1.5">
              <span className="material-symbols-outlined text-outline text-base">search</span>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 text-sm text-on-surface bg-transparent outline-none placeholder:text-outline"
              />
              {query && (
                <span
                  role="button"
                  onClick={() => setQuery('')}
                  className="material-symbols-outlined text-base text-outline cursor-pointer hover:text-on-surface"
                >
                  close
                </span>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-outline text-center">No options found</li>
            ) : (
              filtered.map(opt => {
                const selected = value.includes(opt.value);
                const limitReached = !selected && !!maxSelected && value.length >= maxSelected;
                return (
                  <li
                    key={opt.value}
                    onClick={() => !limitReached && toggle(opt.value)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors
                      ${limitReached ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container-low'}
                      ${selected ? 'bg-primary/5' : ''}`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors
                        ${selected ? 'bg-primary border-primary' : 'border-outline-variant'}`}
                    >
                      {selected && (
                        <span className="material-symbols-outlined text-on-primary text-xs leading-none">check</span>
                      )}
                    </span>
                    <span className={selected ? 'text-on-surface font-medium' : 'text-on-surface-variant'}>
                      {opt.label}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer count */}
          {value.length > 0 && (
            <div className="px-4 py-2 border-t border-outline-variant/30 flex items-center justify-between">
              <span className="text-xs text-outline">{value.length} selected</span>
              <button onClick={clear} className="text-xs text-error hover:underline">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
