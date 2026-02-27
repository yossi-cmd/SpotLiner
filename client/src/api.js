const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('spotliner_token');
}

function headers(includeAuth = true) {
  const h = { 'Content-Type': 'application/json' };
  if (includeAuth && getToken()) h['Authorization'] = `Bearer ${getToken()}`;
  return h;
}

export function getImageUrl(path) {
  if (!path) return null;
  return `${API_BASE}/uploads/${path}`;
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed');
  return data.path;
}

export async function register(email, password, displayName) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: headers() });
  if (res.status === 401) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to get user');
  return data;
}

/** PoC: Get config (e.g. VAPID public key for push). Can remove later. */
export async function getConfig() {
  const res = await fetch(`${API_BASE}/api/config`);
  const data = await res.json().catch(() => ({}));
  return data;
}

/** PoC: Save push subscription for "new track by favorited artist" notifications. Can remove later. */
export async function savePushSubscription(subscription) {
  const res = await fetch(`${API_BASE}/api/me/push-subscription`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ subscription }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to save subscription');
  return data;
}

/** PoC: Request notification permission and register for push. Call after user grants permission. */
export async function registerPushSubscription() {
  const config = await getConfig();
  if (!config?.vapidPublicKey) throw new Error('Push not configured');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = (base64) => {
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(b64);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    };
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key(config.vapidPublicKey),
    });
  }
  await savePushSubscription(sub.toJSON());
}

/** PoC: Send a test push notification to current user. Returns { sent, error? }. */
export async function sendTestPush() {
  const res = await fetch(`${API_BASE}/api/me/push-test`, {
    method: 'POST',
    headers: headers(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed');
  return data;
}

export async function getTracks(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/tracks${q ? '?' + q : ''}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch tracks');
  return data;
}

export function getStreamUrl(trackId) {
  const t = getToken();
  return `${API_BASE}/api/tracks/${trackId}/stream${t ? '?token=' + encodeURIComponent(t) : ''}`;
}

export async function uploadTrack(file, { title, artist_id, album_id, duration_seconds = 0, image_path }) {
  const form = new FormData();
  form.append('audio', file);
  form.append('title', title);
  if (artist_id != null) form.append('artist_id', String(artist_id));
  if (album_id != null) form.append('album_id', String(album_id));
  form.append('duration_seconds', String(duration_seconds));
  if (image_path) form.append('image_path', image_path);
  const res = await fetch(`${API_BASE}/api/tracks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function search(q) {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function getPlaylists() {
  const res = await fetch(`${API_BASE}/api/playlists`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch playlists');
  return data;
}

export async function getPlaylist(id) {
  const res = await fetch(`${API_BASE}/api/playlists/${id}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch playlist');
  return data;
}

export async function createPlaylist(name, isPublic = true) {
  const res = await fetch(`${API_BASE}/api/playlists`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, isPublic }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create playlist');
  return data;
}

export async function addTrackToPlaylist(playlistId, trackId, position) {
  const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ trackId, position }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to add track');
  }
}

export async function removeTrackFromPlaylist(playlistId, trackId) {
  const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks/${trackId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to remove track');
  }
}

export async function getFavorites() {
  const res = await fetch(`${API_BASE}/api/me/favorites`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch favorites');
  return data;
}

export async function addFavorite(trackId) {
  const res = await fetch(`${API_BASE}/api/me/favorites/${trackId}`, { method: 'POST', headers: headers() });
  if (!res.ok) throw new Error('Failed to add favorite');
}

export async function removeFavorite(trackId) {
  const res = await fetch(`${API_BASE}/api/me/favorites/${trackId}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error('Failed to remove favorite');
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/api/me/history`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
  return data;
}

export async function recordHistory(trackId) {
  await fetch(`${API_BASE}/api/me/history`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ trackId }),
  });
}

export async function getArtists(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/artists${q ? '?' + q : ''}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch artists');
  return data;
}

export async function getArtist(id) {
  const res = await fetch(`${API_BASE}/api/artists/${id}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch artist');
  return data;
}

export async function createArtist(name, image_path = null) {
  const res = await fetch(`${API_BASE}/api/artists`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, image_path: image_path || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create artist');
  return data;
}

export async function updateArtist(id, name, image_path) {
  const body = { name };
  if (image_path !== undefined) body.image_path = image_path;
  const res = await fetch(`${API_BASE}/api/artists/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update artist');
  return data;
}

export async function getAlbums(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/albums${q ? '?' + q : ''}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch albums');
  return data;
}

export async function getAlbum(id) {
  const res = await fetch(`${API_BASE}/api/albums/${id}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch album');
  return data;
}

export async function createAlbum(name, artistId, image_path = null) {
  const res = await fetch(`${API_BASE}/api/albums`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, artist_id: artistId, image_path: image_path || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to create album');
  return data;
}

export async function updateAlbum(id, { name, artist_id, image_path }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (artist_id !== undefined) body.artist_id = artist_id;
  if (image_path !== undefined) body.image_path = image_path;
  const res = await fetch(`${API_BASE}/api/albums/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update album');
  return data;
}

export async function updateTrack(id, { title, artist_id, album_id, image_path, featured_artist_ids }) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (artist_id !== undefined) body.artist_id = artist_id;
  if (album_id !== undefined) body.album_id = album_id;
  if (image_path !== undefined) body.image_path = image_path;
  if (featured_artist_ids !== undefined) body.featured_artist_ids = featured_artist_ids;
  const res = await fetch(`${API_BASE}/api/tracks/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update track');
  return data;
}

export async function deleteTrack(id) {
  const res = await fetch(`${API_BASE}/api/tracks/${id}`, { method: 'DELETE', headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 204) throw new Error(data.error || 'Failed to delete track');
}

export async function deleteAlbum(id) {
  const res = await fetch(`${API_BASE}/api/albums/${id}`, { method: 'DELETE', headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 204) throw new Error(data.error || 'Failed to delete album');
}

export async function deleteArtist(id) {
  const res = await fetch(`${API_BASE}/api/artists/${id}`, { method: 'DELETE', headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 204) throw new Error(data.error || 'Failed to delete artist');
}

export async function deletePlaylist(id) {
  const res = await fetch(`${API_BASE}/api/playlists/${id}`, { method: 'DELETE', headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 204) throw new Error(data.error || 'Failed to delete playlist');
}

export async function fetchYouTubePlaylist(urlOrId) {
  const params = new URLSearchParams();
  if (urlOrId.includes('list=') || urlOrId.includes('.')) params.set('url', urlOrId);
  else params.set('id', urlOrId);
  const res = await fetch(`${API_BASE}/api/youtube/playlist?${params}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to fetch YouTube playlist');
  return data;
}

export async function uploadYouTubeThumbnail(imageUrl) {
  const res = await fetch(`${API_BASE}/api/youtube/upload-thumbnail`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ url: imageUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to upload thumbnail');
  return data.path;
}

export async function downloadTrackFromYouTube({ videoId, title, artist_id, album_id, image_path }) {
  const res = await fetch(`${API_BASE}/api/youtube/download-track`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ videoId, title, artist_id, album_id, image_path }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to download track');
  return data;
}
