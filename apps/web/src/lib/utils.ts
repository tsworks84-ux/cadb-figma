import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

/**
 * Rupees in Indian short form for headline figures: ₹3.65 Cr, ₹86.89 L. Below a
 * lakh it is the plain amount. Use where a full ₹3,64,80,312 would not fit; show
 * the exact figure alongside (or in a title) when precision matters.
 */
export function formatCurrencyCompact(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const short = (n: number, unit: string) =>
    `${sign}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)} ${unit}`;
  if (abs >= 1e7) return short(abs / 1e7, "Cr");
  if (abs >= 1e5) return short(abs / 1e5, "L");
  return formatCurrency(amount);
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Resolves a photo URL that may be relative (/uploads/...) or absolute (https://...s3...). */
export function resolvePhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  return photoUrl.startsWith("http") ? photoUrl : `${API_BASE}${photoUrl}`;
}

/**
 * Person's display name. The middle name is optional on students and employees
 * alike, so it is dropped (rather than left as a double space) when absent.
 */
export function fullName(person: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null | undefined) {
  if (!person) return "";
  // Trimmed per part, not just joined: most stored names carry stray leading or
  // trailing spaces, which a plain join renders as a gap in the middle of a name.
  return [person.firstName, person.middleName, person.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
