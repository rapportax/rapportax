import { App, LogLevel } from "@slack/bolt";
import { publishAppHome } from "./publish";
import { parseSlackActionId } from "./actions";
import { createSlackSocketAppContext } from "../di";
import { startApiServer } from "../api/server";

const OWNER_ALIASES: Record<string, string[]> = {
  U0A5S4X6WF3: ["최봉수", "봉수님", "봉수"],
  U0A5D6WJYQJ: ["김기연", "기연님", "기연"],
};
const OWNER_IDS = new Set(Object.keys(OWNER_ALIASES));

const extractMentions = (text?: string): Array<{ userId: string; index: number }> => {
  if (!text) {
    return [];
  }
  const matches = text.matchAll(/<@([A-Z0-9]+)>/g);
  return Array.from(matches, (match) => ({
    userId: match[1],
    index: match.index ?? Number.MAX_SAFE_INTEGER,
  })).filter((match) => Boolean(match.userId) && OWNER_IDS.has(match.userId));
};

const extractAliasMatches = (text?: string): Array<{ userId: string; index: number }> => {
  if (!text) {
    return [];
  }
  const matches: Array<{ userId: string; index: number }> = [];
  for (const [userId, aliases] of Object.entries(OWNER_ALIASES)) {
    for (const alias of aliases) {
      let startIndex = 0;
      while (startIndex < text.length) {
        const found = text.indexOf(alias, startIndex);
        if (found === -1) {
          break;
        }
        matches.push({ userId, index: found });
        startIndex = found + alias.length;
      }
    }
  }
  return matches;
};

const resolveOwnerFromText = (text?: string): string | null => {
  const mentionMatches = extractMentions(text);
  const aliasMatches = extractAliasMatches(text);
  const combined = [...mentionMatches, ...aliasMatches].sort((a, b) => a.index - b.index);
  return combined[0]?.userId ?? null;
};

const normalizeTitle = (text?: string): string => {
  const raw = text?.replace(/\s+/g, " ").trim() ?? "";
  if (raw.length === 0) {
    return "Untitled Slack TODO";
  }
  return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
};

export async function startSlackSocketApp(): Promise<void> {
  const { service, signingSecret, botToken, appToken } = createSlackSocketAppContext();

  void startApiServer(service);

  const app = new App({
    token: botToken,
    signingSecret,
    appToken,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  app.event("app_home_opened", async ({ event }) => {
    console.log("[slack] app_home_opened", event.user);
    const candidates = await service.listCandidates();
    const mine = candidates.filter((candidate) => candidate.suggestedOwner === event.user);
    await publishAppHome({ botToken }, event.user, mine);
  });

  app.event("message", async ({ event }) => {
    console.log("[slack] message", "type" in event ? event.type : "unknown");
    if ("subtype" in event && event.subtype === "bot_message") {
      return;
    }
    const text = "text" in event ? event.text : undefined;
    const ownerUserId = resolveOwnerFromText(text);
    if (ownerUserId) {
      await service.createObligation({
        title: normalizeTitle(text),
        source: "slack",
        inferredReason: "Slack message tagged for owner",
        suggestedOwner: ownerUserId,
      });
    }
  });

  app.event("app_mention", async ({ event }) => {
    console.log("[slack] app_mention", event.user);
    const ownerUserId = resolveOwnerFromText(event.text);
    if (ownerUserId) {
      await service.createObligation({
        title: normalizeTitle(event.text),
        source: "slack",
        inferredReason: "Slack mention tagged for owner",
        suggestedOwner: ownerUserId,
      });
    }
  });

  app.action(/^(execute_|hold_|ignore_)/, async ({ ack, body }) => {
    await ack();
    console.log("[slack] action", body.actions?.[0]?.action_id);
    const action = body.actions?.[0];
    if (action && "action_id" in action && "value" in action) {
      const actionId = String(action.action_id);
      const value = String(action.value ?? "");
      const parsed = parseSlackActionId(actionId, value);
      if (parsed?.action === "EXECUTE" && parsed.candidateId) {
        await service.executeCandidate(parsed.candidateId, body.user?.id);
      } else if (parsed?.candidateId && parsed.status) {
        await service.recordDecision(
          parsed.candidateId,
          parsed.status,
          parsed.action,
          `Slack action: ${parsed.action}`,
        );
      }
    }
    if (body.user?.id) {
      const candidates = await service.listCandidates();
      const mine = candidates.filter((candidate) => candidate.suggestedOwner === body.user?.id);
      await publishAppHome({ botToken }, body.user.id, mine);
    }
  });

  await app.start();
  console.log("Slack Socket Mode app started");
}

if (require.main === module) {
  startSlackSocketApp().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
