import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useHubContent } from '../context/HubContentContext';
import './SearchBar.css';

export default function SearchBar() {
  const { getAllItems } = useHubContent();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return getAllItems().filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sectionTitle.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="search-container">
      <div className={`search-box ${focused ? 'focused' : ''}`}>
        <Search size={20} className="search-icon" />
        <input
          type="text"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className="search-input"
        />
      </div>

      {focused && query.trim() && (
        <div className="search-results">
          {results.length === 0 ? (
            <p className="search-empty">No results for "{query}"</p>
          ) : (
            results.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                to={`/section/${item.sectionId}`}
                className="search-result-item"
              >
                <div>
                  <span className="result-title">{item.title}</span>
                  <span className="result-section">Section {item.sectionNumber}: {item.sectionTitle}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
