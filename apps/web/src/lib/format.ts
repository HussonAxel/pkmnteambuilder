// Numbers in the player's language: "12.5%" / "12,5 %", "8,000" / "8 000", "October 2026" / "octobre 2026".
import { useMemo } from "react";

import { type Lang, useI18n } from "@/lib/i18n";

const cache = new Map<string, Intl.NumberFormat>();
function numberFormat(lang: Lang, options: Intl.NumberFormatOptions) {
  const key = lang + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.NumberFormat(lang, options)));
  return f;
}

// A share between 0 and 1.
export const formatPercent = (lang: Lang, share: number, digits = 0) =>
  numberFormat(lang, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(share);

// A signed change in percentage points ("+1.2" / "+1,2").
export const formatDelta = (lang: Lang, points: number, digits = 1) =>
  numberFormat(lang, {
    signDisplay: "exceptZero",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(points);

export const formatNumber = (lang: Lang, n: number, digits?: number) =>
  numberFormat(lang, digits === undefined ? {} : { maximumFractionDigits: digits }).format(n);

// Pokédollars: the sign before the amount in English, after it in French.
export const formatMoney = (lang: Lang, n: number) =>
  lang === "fr" ? `${formatNumber(lang, n)} ₽` : `₽${formatNumber(lang, n)}`;

// "2026-10" -> "October 2026" / "octobre 2026".
export function formatMonth(lang: Lang, month: string) {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  );
}

// The helpers above, bound to the current language.
export function useFormat() {
  const { lang } = useI18n();
  return useMemo(
    () => ({
      percent: (share: number, digits = 0) => formatPercent(lang, share, digits),
      delta: (points: number, digits = 1) => formatDelta(lang, points, digits),
      number: (n: number, digits?: number) => formatNumber(lang, n, digits),
      money: (n: number) => formatMoney(lang, n),
      month: (month: string) => formatMonth(lang, month),
    }),
    [lang],
  );
}
