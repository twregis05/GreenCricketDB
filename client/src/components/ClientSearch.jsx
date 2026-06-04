import { useState, useEffect, useRef } from 'react';
import { clientName } from '../utils/client';
import './ClientSearch.css';

export default function ClientSearch({
  clients,
  value,
  onChange,
  placeholder = 'Search clients…',
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  const selected = clients.find((c) => c._id === value);

  const filtered = clients.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const name = clientName(c).toLowerCase();
    const contactMatch = (c.contacts || []).some(
      (ct) => (ct.name || '').toLowerCase().includes(q)
    );
    return name.includes(q) || contactMatch;
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const select = (client) => {
    onChange(client._id);
    setQuery('');
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleFocus = () => {
    setQuery('');
    setOpen(true);
  };

  return (
    <div className="cs-wrap" ref={containerRef}>
      <div className={`cs-input-row ${open ? 'cs-open' : ''}`} onClick={() => !open && handleFocus()}>
        <span className="cs-icon">🔍</span>
        <input
          className="cs-input"
          type="text"
          placeholder={open ? 'Type to search…' : (selected ? clientName(selected) : placeholder)}
          value={open ? query : ''}
          onFocus={handleFocus}
          onChange={(e) => setQuery(e.target.value)}
        />
        {selected && !open && (
          <span className="cs-selected-name">{clientName(selected)}</span>
        )}
        {selected ? (
          <button className="cs-clear" onClick={clear} title="Clear">✕</button>
        ) : (
          <span className="cs-chevron">{open ? '▴' : '▾'}</span>
        )}
      </div>

      {open && (
        <div className="cs-dropdown">
          {filtered.length === 0 ? (
            <div className="cs-empty">No clients match "{query}"</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c._id}
                className={`cs-option ${c._id === value ? 'cs-option-selected' : ''}`}
                onMouseDown={() => select(c)}
              >
                <span className="cs-option-avatar">
                  {c.clientType === 'group'
                    ? (c.groupName || 'G').slice(0, 2).toUpperCase()
                    : `${(c.firstName || '?')[0]}${(c.lastName || '?')[0]}`.toUpperCase()}
                </span>
                <span className="cs-option-name">{clientName(c)}</span>
                {c.clientType === 'group' && <span className="cs-group-tag">Group</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
