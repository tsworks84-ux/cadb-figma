import { prisma } from "@cadb/db";
import { NOTIFY_EVENTS, GLOBAL_SETTING_KEY, type NotifyEvent } from "./events.js";

export type ChannelFlags = { emailEnabled: boolean; whatsappEnabled: boolean };

/**
 * Whether each channel may fire for `event`, per the Super-Admin toggles.
 *
 * A channel needs both its own event row AND the GLOBAL row switched on. A
 * missing row counts as enabled, so the table starts empty and only records
 * deviations from the default.
 */
export async function channelsEnabledFor(event: NotifyEvent): Promise<ChannelFlags> {
  const rows = await prisma.notificationSetting.findMany({
    where: { event: { in: [event, GLOBAL_SETTING_KEY] } },
  });

  const global = rows.find((r) => r.event === GLOBAL_SETTING_KEY);
  const own = rows.find((r) => r.event === event);

  return {
    emailEnabled: (global?.emailEnabled ?? true) && (own?.emailEnabled ?? true),
    whatsappEnabled: (global?.whatsappEnabled ?? true) && (own?.whatsappEnabled ?? true),
  };
}

/**
 * The full grid for the Administration tab: the GLOBAL row followed by every
 * known event, with defaults filled in for rows that don't exist yet.
 */
export async function readSettingsGrid(): Promise<Array<{ event: string } & ChannelFlags>> {
  const stored = new Map(
    (await prisma.notificationSetting.findMany()).map((r) => [
      r.event,
      { emailEnabled: r.emailEnabled, whatsappEnabled: r.whatsappEnabled },
    ]),
  );
  const withDefaults = (event: string) => ({
    event,
    ...(stored.get(event) ?? { emailEnabled: true, whatsappEnabled: true }),
  });
  return [GLOBAL_SETTING_KEY, ...NOTIFY_EVENTS].map(withDefaults);
}
