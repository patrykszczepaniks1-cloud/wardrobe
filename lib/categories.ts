export interface Category {
  name: string;
  emoji: string;
  /**
   * Whole words, matched with an optional plural "s"/"es". A trailing "*"
   * makes it a prefix match (Polish and Swedish endings); a leading "*"
   * also matches at the end of a compound word ("vinterjacka").
   */
  keywords: string[];
}

// Order matters for suggestion: the first match wins, so "denim jacket"
// must hit Jackets before Jeans, and "t-shirt" T-shirts before Shirts.
export const CATEGORIES: Category[] = [
  { name: "Suits & blazers", emoji: "🤵", keywords: ["suit", "blazer", "tuxedo", "waistcoat", "*kostym*", "*kavaj*", "garnitur*", "marynark*"] },
  {
    name: "Jackets & coats",
    emoji: "🧥",
    keywords: ["jacket", "coat", "overcoat", "parka", "puffer", "anorak", "gilet", "windbreaker", "bomber", "trench", "shacket", "overshirt", "*jacka", "*jackor", "*jackan", "*kappa", "*kappor", "kurtk*", "płaszcz*", "plaszcz*"],
  },
  { name: "Hoodies & sweats", emoji: "👕", keywords: ["hoodie", "hoody", "sweatshirt", "crewneck", "zip-up", "*huvtröj*", "*luvtröj*", "bluza", "bluzy"] },
  { name: "Knitwear", emoji: "🧶", keywords: ["sweater", "jumper", "cardigan", "knit", "knitted", "pullover", "turtleneck", "rollneck", "*tröj*", "stickad*", "sweter*", "kardigan*"] },
  { name: "T-shirts & tops", emoji: "👚", keywords: ["t-shirt", "tshirt", "tee", "tank top", "top", "polo", "vest top", "camisole", "linne", "koszulk*", "topp*"] },
  { name: "Shirts", emoji: "👔", keywords: ["shirt", "blouse", "*skjort*", "blus*", "bluzk*", "koszul*"] },
  { name: "Jeans", emoji: "👖", keywords: ["jeans", "jean", "denim", "dżins*", "jeansy"] },
  { name: "Trousers", emoji: "👖", keywords: ["trouser", "pant", "chino", "slacks", "jogger", "cargo", "leggings", "sweatpant", "*byx*", "spodn*"] },
  { name: "Shorts", emoji: "🩳", keywords: ["shorts", "short", "spodenk*"] },
  { name: "Dresses & skirts", emoji: "👗", keywords: ["dress", "skirt", "jumpsuit", "*kjol*", "*klänning*", "sukienk*", "spódnic*"] },
  {
    name: "Shoes",
    emoji: "👟",
    keywords: ["shoe", "sneaker", "trainer", "boot", "loafer", "sandal", "heel", "pump", "derby", "oxford", "mule", "slipper", "espadrille", "sko", "*skor", "*känga*", "*stövl*", "buty", "trampk*", "sandał*"],
  },
  { name: "Activewear", emoji: "🏃", keywords: ["sports bra", "running", "training", "gym", "workout", "tights", "yoga", "träning*"] },
  { name: "Underwear & socks", emoji: "🧦", keywords: ["sock", "boxer", "brief", "underwear", "bra", "lingerie", "pyjama", "pajama", "*strump*", "*kalsong*", "skarpet*", "bielizn*"] },
  { name: "Bags", emoji: "👜", keywords: ["bag", "backpack", "tote", "handbag", "wallet", "purse", "duffel", "*väsk*", "*ryggsäck*", "plånb*", "torb*", "plecak*", "portfel*"] },
  {
    name: "Accessories",
    emoji: "🧢",
    keywords: ["belt", "scarf", "hat", "cap", "beanie", "glove", "sunglasses", "tie", "watch", "necklace", "ring", "bracelet", "earring", "jewellery", "jewelry", "bälte*", "halsduk*", "*mössa", "keps*", "handsk*", "pasek", "szalik*", "czapk*", "rękawiczk*"],
  },
  { name: "Other", emoji: "🏷️", keywords: [] },
];

export const DEFAULT_CATEGORY = "Other";

export function categoryEmoji(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? "🏷️";
}

const LETTER = "a-z0-9åäöąćęłńóśźżü";
const patterns = CATEGORIES.map((cat) => ({
  name: cat.name,
  res: cat.keywords.map((kw) => {
    const prefix = kw.endsWith("*");
    const suffix = kw.startsWith("*");
    const word = escapeRegExp(kw.replace(/^\*|\*$/g, "").replace(/-/g, " "));
    return new RegExp(`${suffix ? "" : `(^|[^${LETTER}])`}${word}${prefix ? "" : `(e?s)?(?![${LETTER}])`}`, "i");
  }),
}));

/** Guess a category from a product title (and optionally the URL). */
export function suggestCategory(...texts: (string | null | undefined)[]): string | null {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase().replace(/[-_/]+/g, " ");
  if (!haystack.trim()) return null;
  for (const cat of patterns) {
    if (cat.res.some((re) => re.test(haystack))) return cat.name;
  }
  return null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Starter lists offered when creating a new list. */
export const LIST_TEMPLATES = [
  { name: "Work clothes", emoji: "💼" },
  { name: "Winter outfits", emoji: "❄️" },
  { name: "Summer", emoji: "☀️" },
  { name: "Going out", emoji: "🍸" },
  { name: "Gym", emoji: "🏋️" },
  { name: "Wedding guest", emoji: "💍" },
  { name: "Basics", emoji: "🧺" },
  { name: "Sale watch", emoji: "🏷️" },
];

export const LIST_EMOJIS = ["👕", "💼", "❄️", "☀️", "🍸", "🏋️", "💍", "🧺", "🏷️", "👟", "🧥", "👗", "🎁", "✈️", "🎄", "⭐"];
