import React from 'react';

export const Skeleton = ({ width = '100%', height = 16, radius, className = '', style }) => (
  <span
    className={`skeleton ${className}`.trim()}
    style={{ width, height, borderRadius: radius, ...style }}
    aria-hidden="true"
  />
);
