/* PoC: Push notifications for new track by favorited artist. Can remove later. */
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ספוטליינר';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.svg',
    data: { url: data.url || '/' },
  };
  // תמונה גדולה – ב-macOS לא מוצגת (מערכת ההתראות של Apple לא תומכת), רק ב-Windows/Android
  if (data.image && typeof data.image === 'string' && data.image.trim()) {
    const imgUrl = data.image.trim();
    options.image = imgUrl.startsWith('http://') || imgUrl.startsWith('https://') ? imgUrl : new URL(imgUrl, self.registration.scope).href;
  }
  if (data.badge && typeof data.badge === 'string' && data.badge.trim()) {
    const badgeUrl = data.badge.trim();
    options.badge = badgeUrl.startsWith('http://') || badgeUrl.startsWith('https://') ? badgeUrl : new URL(badgeUrl, self.registration.scope).href;
  }
  const tag = data.tag != null ? String(data.tag).trim() : '';
  if (tag) {
    options.tag = tag;
    options.renotify = true; // כשמחליפים התראה עם אותו tag – עדיין להציג/להשמיע
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(self.clients.openWindow(event.notification.data.url));
  }
});
