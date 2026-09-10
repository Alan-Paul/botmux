import { AsyncSerialQueue } from '../utils/async-serial-queue.js';
import { getBot } from '../bot-registry.js';
import { normalizeGroupDefaultModels, parseGroupDefaultModels } from '../core/group-default-models.js';
import { rmwBotEntry } from './config-store.js';

const configWrites = new AsyncSerialQueue();

export async function setGroupDefaultModels(appId: string, chatId: string, raw: unknown) {
  if (!/^oc_[a-zA-Z0-9_-]+$/.test(chatId)) throw new Error('invalid_chat_id');
  const models = parseGroupDefaultModels(raw);
  return configWrites.run(async () => {
    const bot = getBot(appId);
    const result = await rmwBotEntry(appId, entry => {
      const groups = normalizeGroupDefaultModels(entry.groupDefaultModels);
      if (Object.keys(models).length) groups[chatId] = models;
      else delete groups[chatId];
      if (Object.keys(groups).length) entry.groupDefaultModels = groups;
      else delete entry.groupDefaultModels;
      // The queue keeps memory publication in the same order as disk writes.
      return { write: true, result: groups };
    });
    if (result.ok) bot.config.groupDefaultModels = result.result;
    return result.ok ? { ok: true as const, models } : result;
  });
}
