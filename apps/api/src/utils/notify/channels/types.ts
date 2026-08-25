/**
 * What a channel reports back to the dispatcher.
 *
 *   SENT    — accepted by the provider
 *   RETRY   — transient; try again after the backoff
 *   FAILED  — permanent rejection, do not retry
 *   SKIPPED — nothing was attempted (channel unconfigured, recipient opted out)
 *
 * The RETRY/FAILED split is the whole point: retrying a permanently rejected
 * message just burns attempts and hides the real error.
 */
export type DeliveryResult = {
  status: "SENT" | "RETRY" | "FAILED" | "SKIPPED";
  error?: string;
};
