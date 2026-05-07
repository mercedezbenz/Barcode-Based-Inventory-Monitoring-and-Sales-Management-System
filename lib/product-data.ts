// ─── Centralized Product Data ─────────────────────────────────────────────────
// Single source of truth for Categories, Types, and Product Names.
// Used by add-item-dialog, edit-item-dialog, and inventory-table.

// ─── Category constants ──────────────────────────────────────────────────────
export const CATEGORIES = ["Finished Product", "By-product"] as const
export type CategoryValue = (typeof CATEGORIES)[number]

// ─── Type constants ──────────────────────────────────────────────────────────
export const TYPES = ["Beef", "Pork", "Chicken"] as const
export type TypeValue = (typeof TYPES)[number]

// Additional types only available for specific categories
export const EXTRA_TYPES: Record<string, string[]> = {
  "Finished Product": ["Retail"],
  "By-product": ["Others"],
}

/** Returns all available types for a given category */
export function getTypesForCategory(category: string): string[] {
  const base = [...TYPES] as string[]
  const extras = EXTRA_TYPES[category]
  if (extras) base.push(...extras)
  return base
}

// ─── Product interface ───────────────────────────────────────────────────────
export interface ProductEntry {
  category: string // "Finished Product" | "By-product"
  type: string     // "Beef" | "Pork" | "Chicken" | "Retail" | "Others"
  name: string     // Cleaned product name
}

// ─── Preloaded product list ──────────────────────────────────────────────────
export const PRODUCT_LIST: ProductEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FINISHED PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Chicken
  { category: "Finished Product", type: "Chicken", name: "Chicken Leg Quarter (Diced)" },
  { category: "Finished Product", type: "Chicken", name: "Chicken Leg Fillet (26g–28g)" },
  { category: "Finished Product", type: "Chicken", name: "Chicken Trimmings (For Boiling)" },

  // Pork
  { category: "Finished Product", type: "Pork", name: "Pork Back Fat (Sliced)" },
  { category: "Finished Product", type: "Pork", name: "Pork Belly (BLSO)" },
  { category: "Finished Product", type: "Pork", name: "Pork Belly (BLSL Kimbob Cut)" },
  { category: "Finished Product", type: "Pork", name: "Pork Boston Butt" },
  { category: "Finished Product", type: "Pork", name: "Pork Ham (For Pork Chop)" },
  { category: "Finished Product", type: "Pork", name: "Pork Shoulder (For Slice and Dice)" },
  { category: "Finished Product", type: "Pork", name: "Pork Jowl (Skin-On)" },
  { category: "Finished Product", type: "Pork", name: "Pork Loin (BLSL)" },
  { category: "Finished Product", type: "Pork", name: "Pork Jowl (Sliced for Sisig)" },
  { category: "Finished Product", type: "Pork", name: "Pork Jowl (Sliced)" },
  { category: "Finished Product", type: "Pork", name: "Pork Ham (For Slice and Dice)" },

  // Retail
  { category: "Finished Product", type: "Retail", name: "Pinoy Pork BBQ (6 Sticks)" },
  { category: "Finished Product", type: "Retail", name: "Pork Chop (500g)" },
  { category: "Finished Product", type: "Retail", name: "Pork Kasim (500g)" },
  { category: "Finished Product", type: "Retail", name: "Pork Pang-Ihaw (500g)" },
  { category: "Finished Product", type: "Retail", name: "Ground Pork (500g)" },

  // ═══════════════════════════════════════════════════════════════════════════
  // BY-PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Beef
  { category: "By-product", type: "Beef", name: "Beef Shortplate Trimmings" },
  { category: "By-product", type: "Beef", name: "Beef Shortplate Meat Trimmings" },
  { category: "By-product", type: "Beef", name: "Beef Trimmings" },
  { category: "By-product", type: "Beef", name: "Beef (For Grinding)" },
  { category: "By-product", type: "Beef", name: "Beef (For Disposal)" },

  // Chicken
  { category: "By-product", type: "Chicken", name: "Chicken Back Trimmings" },
  { category: "By-product", type: "Chicken", name: "Chicken Back Trimmings (Alternative)" },
  { category: "By-product", type: "Chicken", name: "Chicken Leg Bone" },
  { category: "By-product", type: "Chicken", name: "Chicken Skin" },
  { category: "By-product", type: "Chicken", name: "Chicken Skin and Fat" },
  { category: "By-product", type: "Chicken", name: "Chicken Tail" },
  { category: "By-product", type: "Chicken", name: "Chicken Trimmings (For Grinding)" },
  { category: "By-product", type: "Chicken", name: "Chicken Trimmings (Marinated)" },
  { category: "By-product", type: "Chicken", name: "Cooked Assorted Bones" },
  { category: "By-product", type: "Chicken", name: "Chicken (For Disposal)" },

  // Pork
  { category: "By-product", type: "Pork", name: "Pork Adobo Cut" },
  { category: "By-product", type: "Pork", name: "Pork Bias Cut" },
  { category: "By-product", type: "Pork", name: "Pork BBQ Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Costal Ribs" },
  { category: "By-product", type: "Pork", name: "Pork Fat" },
  { category: "By-product", type: "Pork", name: "Pork Loin Bone" },
  { category: "By-product", type: "Pork", name: "Pork Leg Bone" },
  { category: "By-product", type: "Pork", name: "Pork Tail Bone" },
  { category: "By-product", type: "Pork", name: "Pork Ear" },
  { category: "By-product", type: "Pork", name: "Pork Tail" },
  { category: "By-product", type: "Pork", name: "Pork Liver" },
  { category: "By-product", type: "Pork", name: "Pork Belly Skin" },
  { category: "By-product", type: "Pork", name: "Pork Ham Skin" },
  { category: "By-product", type: "Pork", name: "Pork Jowl Skin" },
  { category: "By-product", type: "Pork", name: "Pork Shoulder Skin" },
  { category: "By-product", type: "Pork", name: "Pork Skin Strips" },
  { category: "By-product", type: "Pork", name: "Pork Feet (Sliced)" },
  { category: "By-product", type: "Pork", name: "Pork (For Grinding)" },
  { category: "By-product", type: "Pork", name: "Pork Paypay Cut" },
  { category: "By-product", type: "Pork", name: "Pork (For Pet Food)" },
  { category: "By-product", type: "Pork", name: "Pork Rib Stick" },
  { category: "By-product", type: "Pork", name: "Pork Hard Bone" },
  { category: "By-product", type: "Pork", name: "Pork Bones (For Disposal)" },
  { category: "By-product", type: "Pork", name: "Pork Litid (Tendon)" },
  { category: "By-product", type: "Pork", name: "Pork Pata Hock" },
  { category: "By-product", type: "Pork", name: "Pork BBQ Ribs (Reject)" },
  { category: "By-product", type: "Pork", name: "Pork Pata Hock (Reject)" },
  { category: "By-product", type: "Pork", name: "Pork Pata Hock (Offsize)" },
  { category: "By-product", type: "Pork", name: "Pork Cheek Meat Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Shoulder Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Pata Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Loin Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Jowl Meat Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Ham Leg Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Ham Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Belly Trimmings" },
  { category: "By-product", type: "Pork", name: "Boiled Pork Pata (Reject)" },
  { category: "By-product", type: "Pork", name: "Boiled Pork Jowl Trimmings" },
  { category: "By-product", type: "Pork", name: "Boiled Pork Belly Trimmings" },
  { category: "By-product", type: "Pork", name: "Pork Skin" },
  { category: "By-product", type: "Pork", name: "Pork Loin Skin" },
  { category: "By-product", type: "Pork", name: "Pork Cheek Meat Skin" },
  { category: "By-product", type: "Pork", name: "Pork Shoulder Skin" },
  { category: "By-product", type: "Pork", name: "Pork Jowl Skin" },
  { category: "By-product", type: "Pork", name: "Pork Belly Skin" },

  // Others
  { category: "By-product", type: "Others", name: "Sawdust" },
]

// ─── Filtering helper ────────────────────────────────────────────────────────

/** Returns products matching the given category and type */
export function getFilteredProducts(category: string, type: string): ProductEntry[] {
  return PRODUCT_LIST.filter(
    (p) => p.category === category && p.type === type
  )
}

// ─── Category prefix map for barcode generation ──────────────────────────────
export const categoryPrefixMap: Record<string, string> = {
  "Finished Product": "FP",
  "By-product": "BP",
}

// ─── Whether this category requires a product name selection ─────────────────
export function categoryRequiresProductName(category: string): boolean {
  return category === "Finished Product" || category === "By-product"
}

/** Build a display name for an inventory item based on new fields */
export function buildProductDisplayName(item: {
  category?: string
  productType?: string
  productName?: string
  subcategory?: string
  name?: string
}): string {
  // New system: if productName is set, use it directly
  if (item.productName?.trim()) {
    return item.productName.trim()
  }

  // Raw Material — just show "Raw Material - {type}"
  if (item.category === "Raw Material" && item.productType?.trim()) {
    return `Raw Material - ${item.productType.trim()}`
  }

  // Backward compatibility: CATEGORY - SUBCATEGORY
  const category = item.category?.toUpperCase()?.trim() || ""
  const subcategory = item.subcategory?.toUpperCase()?.trim() || ""
  if (category && subcategory) {
    return `${category} - ${subcategory}`
  }

  // Fallback to name field or category
  if (item.name?.trim()) return item.name.trim()
  return category || "-"
}
