import { useState } from 'react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

export const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm.trim());
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索书名或作者..."
          className="flex-1 px-4 py-2.5 border border-cyan-300/25 bg-white/10 text-cyan-50 placeholder:text-cyan-100/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 transition-all shadow-[0_10px_26px_-10px_rgba(34,211,238,0.7)]"
        >
          搜索
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-2.5 rounded-xl text-cyan-100 border border-cyan-300/25 bg-white/10 hover:bg-white/20 transition-colors"
          >
            清除
          </button>
        )}
      </div>
    </form>
  );
};
