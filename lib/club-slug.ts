/** Kulüp adını URL slug'ına çevir */
export function toClubSlug(clubName: string): string {
  return encodeURIComponent(clubName.trim());
}

/** URL slug'ından kulüp adını geri al */
export function fromClubSlug(slug: string): string {
  try {
    return decodeURIComponent(slug).trim();
  } catch {
    return slug.trim();
  }
}

export function clubPath(clubName: string): string {
  return `/clubs/${toClubSlug(clubName)}`;
}
