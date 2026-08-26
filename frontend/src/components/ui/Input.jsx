import React from 'react';
import { ChevronDown } from 'lucide-react';

export const Input = React.forwardRef(
  ({ label, icon: Icon, right, hint, error, className = '', ...props }, ref) => (
    <div className="field">
      {label && <label className="field__label">{label}</label>}
      <div className="field__control">
        {Icon && <Icon size={16} className="field__icon" aria-hidden="true" />}
        <input
          ref={ref}
          className={`field__input ${Icon ? 'field__input--with-icon' : ''} ${error ? 'field__input--invalid' : ''} ${className}`.trim()}
          {...props}
        />
        {right && <div className="field__right">{right}</div>}
      </div>
      {error && <p className="field__hint field__hint--error">{error}</p>}
      {!error && hint && <p className="field__hint">{hint}</p>}
    </div>
  )
);
Input.displayName = 'Input';

export const Select = ({ label, icon: Icon, hint, children, ...props }) => (
  <div className="field">
    {label && <label className="field__label">{label}</label>}
    <div className="field__control">
      {Icon && <Icon size={16} className="field__icon" aria-hidden="true" />}
      <select className={`field__select ${Icon ? 'field__select--with-icon' : ''}`} {...props}>
        {children}
      </select>
      <span className="field__right" style={{ pointerEvents: 'none' }} aria-hidden="true">
        <ChevronDown size={16} />
      </span>
    </div>
    {hint && <p className="field__hint">{hint}</p>}
  </div>
);
