import type { RideType } from '../../lib/fare';
import { calculateFare, formatFare } from '../../lib/fare';

interface RideTypeSelectorProps {
  selected: RideType;
  onSelect: (type: RideType) => void;
  distanceKm?: number;
  durationMin?: number;
}

const RIDE_TYPES: { type: RideType; label: string; icon: string; description: string }[] = [
  { type: 'economy', label: 'Economy', icon: '🚗', description: 'Affordable everyday rides' },
  { type: 'comfort', label: 'Comfort', icon: '🚙', description: 'Newer cars, extra legroom' },
  { type: 'xl', label: 'XL', icon: '🚐', description: 'SUVs & vans, 5+ seats' },
];

export default function RideTypeSelector({ selected, onSelect, distanceKm, durationMin }: RideTypeSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {RIDE_TYPES.map(({ type, label, icon, description }) => {
        const isSelected = selected === type;
        const fare = distanceKm && distanceKm > 0
          ? calculateFare(distanceKm, durationMin ?? 0, type)
          : null;

        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`flex-shrink-0 w-28 rounded-xl p-3 text-left transition-all border-2 ${
              isSelected
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <p className={`text-sm font-semibold mt-1 ${
              isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'
            }`}>
              {label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
            {fare !== null && (
              <p className={`text-sm font-bold mt-1 ${
                isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {formatFare(fare)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
