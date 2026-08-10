import React from 'react';

export const Button = ({ children, variant = 'primary', size = 'md', block, loading, icon: Icon, className = '', ...props }) => {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={props.disabled || loading} {...props}>
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" style={{ width: 16, height: 16, borderWidth: 2 }} />
          {children}
        </>
      ) : (
        <>
          {Icon && <Icon size={16} aria-hidden="true" />}
          {children}
        </>
      )}
    </button>
  );
};
