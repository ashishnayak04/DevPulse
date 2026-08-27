import React, { useRef, useEffect, useState } from 'react';
import { formatRelative } from '../utils/time';

export const RelativeTime = React.memo(({ time, fallback = '—' }) => {
  const [, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return <time dateTime={time || undefined}>{time ? formatRelative(time) : fallback}</time>;
});
