import React from 'react';

export const Segmented = React.memo(({ options, value, onChange, ariaLabel }) => (
  <div className="segmented" role="tablist" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.value}
        role="tab"
        aria-selected={value === opt.value}
        className={`segmented__btn ${value === opt.value ? 'segmented__btn--active' : ''}`}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
));
