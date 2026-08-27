import React from 'react';

export const Spinner = React.memo(({ size = 'md' }) => (
  <span className={`spinner ${size === 'lg' ? 'spinner--lg' : ''}`} role="status" aria-label="Loading" />
));
