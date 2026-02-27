/* PoC: Push notifications for new track by favorited artist. Can remove later. */
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ספוטליינר';
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(self.clients.openWindow(event.notification.data.url));
  }
});
