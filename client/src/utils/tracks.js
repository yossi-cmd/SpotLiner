/**
 * מחזיר רשימת שירים ללא כפילויות לפי id (שומר את המופע הראשון = האחרון שהושמע).
 */
export function uniqueTracksById(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
