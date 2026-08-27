import React from 'react';

export const Card = React.memo(({ children, className = '', hover, ...props }) => (
  <div className={`card ${hover ? 'card--hover' : ''} ${className}`.trim()} {...props}>
    {children}
  </div>
));
