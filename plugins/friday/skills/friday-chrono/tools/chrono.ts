interface Input {
  timezone?: string;
}

function formatTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "?";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return `${hour}:${minute} ${dayPeriod}`.trim();
}

function timezoneLabel(zone: string): string {
  const parts = zone.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

export default {
  execute(input: Input) {
    const timeZone = input.timezone?.trim() || process.env.TZ || "America/Los_Angeles";
    try {
      const formatted = formatTime(new Date(), timeZone);
      return {
        content: `It\u2019s exactly ${formatted} in ${timezoneLabel(timeZone)}, Boss. Chrono matrix synced.`,
        isError: false,
      };
    } catch {
      return {
        content: `Timezone not recognized, Boss. Fallback is ${timezoneLabel(process.env.TZ || "America/Los_Angeles")}. Chrono matrix synced.`,
        isError: false,
      };
    }
  },
};
