import React, { useState, useEffect } from 'react';
import { formatRelative } from '../utils/time';

export const RelativeTime = ({ time, fallback = '—' }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  return <time dateTime={time || undefined}>{time ? formatRelative(time) : fallback}</time>;
};
