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
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}
