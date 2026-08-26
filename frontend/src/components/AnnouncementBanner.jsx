import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api';

const DISMISS_KEY = 'dp_dismissed_announcement';

export const AnnouncementBanner = () => {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/announcement')
      .then((data) => {
        if (cancelled || !data?.message) return;
        let dismissedMessage = null;
        try {
          dismissedMessage = sessionStorage.getItem(DISMISS_KEY);
        } catch {
          dismissedMessage = null;
        }
        if (dismissedMessage !== data.message) {
          setAnnouncement({ message: data.message, type: data.type });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, announcement.message);
    } catch {
      // storage unavailable — still hide for this visit
    }
    setAnnouncement(null);
  };

  return (
    <div className={`announcement-banner announcement-banner--${announcement.type || 'info'}`}>
      <span>{announcement.message}</span>
      <button
        className="announcement-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
      >
        <X size={15} />
      </button>
    </div>
  );
};
