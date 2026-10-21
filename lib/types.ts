export type ItemStatus = "wanted" | "ordered" | "owned";

export interface PricePoint {
  price: number;
  at: number;
}

export interface Item {
  id: string;
  url: string;
  title: string;
  brand?: string;
  price: number | null;
  /** The store's "was" price when the item is on sale */
  originalPrice?: number | null;
  currency: string;
  image?: string;
  store?: string;
  category: string;
  size?: string;
  color?: string;
  status: ItemStatus;
  favorite?: boolean;
  notes?: string;
  /** Prices seen on each refresh, oldest first */
  priceHistory?: PricePoint[];
  createdAt: number;
}

export interface GalleryImage {
  id: string;
  /** data: URL for uploaded photos, or a remote https URL */
  src: string;
  caption?: string;
}

export interface Wishlist {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  currency: string;
  images: GalleryImage[];
  items: Item[];
  createdAt: number;
  updatedAt: number;
}

export interface ScrapeResult {
  url: string;
  title: string | null;
  brand: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string | null;
  image: string | null;
  images: string[];
  store: string | null;
  suggestedCategory: string | null;
}
