// A team's shopping list: the held items and TMs its sets need, with what the TMs cost. TM rows come from
// scripts/build-tm-sources.mjs (Bulbapedia text), so costs are read out of free text here.
// Pure: tested in shopping.test.mjs.

export interface TmRow {
  games: string;
  found?: string;
  craft?: string; // Scarlet/Violet: "8,000 LP; Cufant Tarnish ×5; …" (and "60 BP" at the Blueberry store)
  price?: string; // "₽8,000"
}
export interface TmSource {
  tm: string; // item identifier ("tm99")
  rows: TmRow[];
}

export interface Material {
  name: string; // "Cufant Tarnish"
  species: string; // "Cufant": the Pokémon that drops it
  count: number;
}

export interface TmCost {
  price?: number; // ₽
  lp?: number; // League Points (Scarlet/Violet TM Machine)
  bp?: number; // Battle Points
  materials: Material[];
}

const number = (text: string) => Number(text.replaceAll(",", ""));

// A material is named after the Pokémon that drops it: every word but the last ("Mr. Mime Dust" too).
export const materialSpecies = (material: string) => material.split(" ").slice(0, -1).join(" ");

export function tmCost(row: TmRow): TmCost {
  const craft = row.craft ?? "";
  const price = row.price?.match(/₽\s?([\d,]+)/)?.[1];
  const lp = craft.match(/([\d,]+) LP/)?.[1];
  const bp = craft.match(/([\d,]+) ?BP/)?.[1];
  const materials = [...craft.matchAll(/([A-Z][\w'’.-]*(?: [A-Z][\w'’.-]*)+) ×(\d+)/g)].map(
    ([, name, count]) => ({ name: name!, species: materialSpecies(name!), count: Number(count) }),
  );
  return {
    price: price ? number(price) : undefined,
    lp: lp ? number(lp) : undefined,
    bp: bp ? number(bp) : undefined,
    materials,
  };
}

export interface ShoppingTm extends TmCost {
  move: string;
  tm: string;
  found?: string;
}

export interface ShoppingList {
  items: { name: string; count: number }[];
  tms: ShoppingTm[];
  materials: Material[]; // all TMs' materials, summed per material
  total: { price: number; lp: number };
}

// items: every member's held item; tmMoves: the moves that need a TM (no level-up or evolution route).
// A TM is bought once even if several members use it (Scarlet/Violet TMs are single-use, but the list
// counts what to get, not how many copies: crafting another is the same recipe).
export function shoppingList(
  items: string[],
  tmMoves: string[],
  sources: Record<string, TmSource>,
): ShoppingList {
  const itemCounts = new Map<string, number>();
  for (const item of items.filter(Boolean)) itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);

  const tms: ShoppingTm[] = [];
  for (const move of new Set(tmMoves)) {
    const source = sources[move];
    if (!source) continue;
    const row = source.rows[0];
    tms.push({
      move,
      tm: source.tm,
      found: row?.found,
      ...(row ? tmCost(row) : { materials: [] }),
    });
  }

  const materials = new Map<string, Material>();
  for (const m of tms.flatMap((t) => t.materials)) {
    const prev = materials.get(m.name);
    materials.set(m.name, { ...m, count: (prev?.count ?? 0) + m.count });
  }

  return {
    items: [...itemCounts].map(([name, count]) => ({ name, count })),
    tms,
    materials: [...materials.values()].sort((a, b) => b.count - a.count),
    total: {
      price: tms.reduce((sum, t) => sum + (t.price ?? 0), 0),
      lp: tms.reduce((sum, t) => sum + (t.lp ?? 0), 0),
    },
  };
}

// Whether a move needs a TM: taught by one, and not learnable by level-up or on evolution (those are free).
// Takes howToLearn()'s methods (lib/learn.ts); null (can't learn it) needs nothing to buy.
export function needsTm(methods: readonly { kind: string }[] | null): boolean {
  if (!methods?.some((m) => m.kind === "tm")) return false;
  return !methods.some((m) => m.kind === "level" || m.kind === "evolution");
}

// A Bulbapedia "found" cell as places: "Levincia, Casseroya Lake, TM Machine / Only in The Teal Mask:;
// Timeless Woods" -> { base: ["Levincia", "Casseroya Lake"], dlc: [{ name: "The Teal Mask", places:
// ["Timeless Woods"] }] }. The TM Machine is left out: the crafting recipe already says it.
export function splitPlaces(found: string): {
  base: string[];
  dlc: { name: string; places: string[] }[];
} {
  // Commas inside parentheses ("West Province (Area One)") don't separate places.
  const list = (text: string) =>
    text
      .split(/[;,]\s*(?![^(]*\))/)
      .map((p) => p.trim())
      .filter((p) => p && p !== "TM Machine");
  const [base = "", ...groups] = found.split(" / ");
  return {
    base: list(base),
    dlc: groups.flatMap((group) => {
      const only = group.match(/^Only in (.+?):\s*;?\s*(.*)$/);
      return only
        ? [{ name: only[1]!, places: list(only[2]!) }]
        : [{ name: "", places: list(group) }];
    }),
  };
}
