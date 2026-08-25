/**
 * Phone numbers in this database are free text typed by whoever filled the form:
 * "9876543210", "+91 98765 43210", "098765-43210", "91 9876543210". WhatsApp
 * needs E.164 with no punctuation, so everything has to be normalised at the
 * point of sending rather than trusted as stored.
 *
 * `DEFAULT_COUNTRY_CODE` (digits only, no "+") is applied to bare national
 * numbers; it defaults to India.
 */

const DEFAULT_CC = (process.env.DEFAULT_COUNTRY_CODE ?? "91").replace(/\D/g, "");

/**
 * Best-effort E.164 (`+919876543210`). Returns null when the input can't be
 * read as a phone number — the caller treats that as "no WhatsApp for this
 * person" rather than guessing and messaging a stranger.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.trim();
  // "00" is the international prefix in most of the world — same intent as "+".
  const hadPlus = digits.startsWith("+") || digits.startsWith("00");
  digits = digits.replace(/^00/, "").replace(/\D/g, "");
  if (!digits) return null;

  // A leading trunk "0" is national dialling and never part of E.164.
  if (!hadPlus && digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Bare national number → prepend the default country code.
  if (!hadPlus && digits.length === 10) {
    digits = DEFAULT_CC + digits;
  }

  // E.164 allows at most 15 digits, and nothing real is shorter than 8.
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/**
 * The number to WhatsApp an employee on: the explicit override first, then the
 * official line, then the personal one. Honours the opt-in flag — an employee
 * who has switched WhatsApp off gets nothing, whatever numbers are on file.
 */
export function whatsappNumberFor(employee: {
  whatsappNumber?: string | null;
  whatsappOptIn?: boolean | null;
  officialPhone?: string | null;
  personalPhone?: string | null;
}): string | null {
  if (employee.whatsappOptIn === false) return null;
  return (
    toE164(employee.whatsappNumber) ??
    toE164(employee.officialPhone) ??
    toE164(employee.personalPhone)
  );
}
