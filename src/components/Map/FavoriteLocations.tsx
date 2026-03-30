import { useFavorites, type FavoriteLocation } from '../../hooks/useFavorites';

interface FavoriteLocationsProps {
  onSelect: (lat: number, lng: number, address: string) => void;
}

const ICON_MAP: Record<string, string> = {
  home: '🏠',
  work: '💼',
  star: '⭐',
  heart: '❤️',
  gym: '🏋️',
  school: '🎓',
};

export default function FavoriteLocations({ onSelect }: FavoriteLocationsProps) {
  const { favorites, loading } = useFavorites();

  if (loading || favorites.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {favorites.map((fav) => (
        <button
          key={fav.id}
          onClick={() => onSelect(fav.lat, fav.lng, fav.address)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-sm whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <span>{ICON_MAP[fav.icon] || '⭐'}</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">{fav.label}</span>
        </button>
      ))}
    </div>
  );
}
