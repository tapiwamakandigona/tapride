import { useState, useRef, useEffect, useCallback } from 'react';
import { searchAddress, type NominatimResult } from '../../lib/geo';

interface AddressSearchProps {
  placeholder?: string;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  value?: string;
  className?: string;
  icon?: 'pickup' | 'destination';
}

export default function AddressSearch({
  placeholder = 'Search for a place...',
  onSelect,
  value = '',
  className = '',
  icon = 'destination',
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchAddress(q);
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 600);
  };

  const handleSelect = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    // Show a shortened display name
    const parts = result.display_name.split(',').slice(0, 3).map(s => s.trim());
    const shortName = parts.join(', ');
    setQuery(shortName);
    setOpen(false);
    setResults([]);
    onSelect(lat, lng, shortName);
  };

  const dotColor = icon === 'pickup' ? 'bg-green-500' : 'bg-red-500';
  const ringColor = icon === 'pickup' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent transition-all">
        <div className={`w-8 h-8 ${ringColor} rounded-full flex items-center justify-center flex-shrink-0`}>
          <div className={`w-3 h-3 ${dotColor} rounded-full`} />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {/* [Z-INDEX] z-[2000] — must float above Leaflet map tiles (z-400+) and other UI panels */}
      {open && results.length > 0 && (
        <div className="absolute z-[2000] left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
            >
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {r.display_name.split(',').slice(0, 2).join(',')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {r.display_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
