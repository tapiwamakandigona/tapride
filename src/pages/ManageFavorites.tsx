import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites, type FavoriteLocation } from '../hooks/useFavorites';
import { useLoadingTimeout } from '../hooks/useLoadingTimeout';
import RetryError from '../components/Layout/RetryError';

const ICONS = [
  { value: 'home', emoji: '🏠', label: 'Home' },
  { value: 'work', emoji: '💼', label: 'Work' },
  { value: 'star', emoji: '⭐', label: 'Star' },
  { value: 'heart', emoji: '❤️', label: 'Heart' },
  { value: 'gym', emoji: '🏋️', label: 'Gym' },
  { value: 'school', emoji: '🎓', label: 'School' },
];

export default function ManageFavorites() {
  const navigate = useNavigate();
  const { favorites, loading, addFavorite, updateFavorite, deleteFavorite, refresh } = useFavorites();
  const { slow, timedOut } = useLoadingTimeout(loading);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [icon, setIcon] = useState('star');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLabel('');
    setAddress('');
    setIcon('star');
  };

  const startEdit = (fav: FavoriteLocation) => {
    setEditingId(fav.id);
    setLabel(fav.label);
    setAddress(fav.address);
    setIcon(fav.icon);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    if (editingId) {
      await updateFavorite(editingId, { label: label.trim(), address: address.trim(), icon });
    } else {
      // For new favorites, use 0,0 coords (user would set via map in a full implementation)
      await addFavorite({ label: label.trim(), lat: 0, lng: 0, address: address.trim(), icon });
    }
    setSaving(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteFavorite(id);
  };

  const getEmoji = (iconValue: string) => ICONS.find(i => i.value === iconValue)?.emoji || '⭐';

  if (loading) {
    if (timedOut) {
      return <RetryError message="Couldn't load saved places" onRetry={refresh} />;
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-2">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        {slow && <p className="text-sm text-gray-400 dark:text-gray-500">Taking longer than expected…</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-white dark:bg-gray-900 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Places</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quick access to your favorite locations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="px-4 py-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Place' : 'Add New Place'}
            </h3>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Home, Work)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Icon</p>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map((ic) => (
                  <button
                    key={ic.value}
                    onClick={() => setIcon(ic.value)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                      icon === ic.value
                        ? 'bg-primary-100 dark:bg-primary-900/40 ring-2 ring-primary-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {ic.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!label.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites List */}
      <div className="px-4 space-y-2 mt-2">
        {favorites.length === 0 && !showForm ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">📍</p>
            <p className="text-gray-500 dark:text-gray-400">No saved places yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tap + to add your first one</p>
          </div>
        ) : (
          favorites.map((fav) => (
            <div
              key={fav.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-lg">
                {getEmoji(fav.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fav.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{fav.address || 'No address'}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(fav)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(fav.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
