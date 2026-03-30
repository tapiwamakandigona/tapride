import { useState } from 'react';

interface RatingTagsProps {
  isDriver: boolean;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const DRIVER_TAGS = ['Great driving', 'Clean car', 'Good conversation', 'Arrived fast', 'Knew the route', 'Professional'];
const RIDER_TAGS = ['Friendly', 'On time', 'Good directions', 'Respectful'];

export default function RatingTags({ isDriver, selectedTags, onTagsChange }: RatingTagsProps) {
  const tags = isDriver ? RIDER_TAGS : DRIVER_TAGS;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="mb-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Quick feedback</p>
      <div className="flex flex-wrap justify-center gap-2">
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selected
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
