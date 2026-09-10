/** New-topic defaults, keyed by CLI so model names never cross providers. */
export type GroupDefaultModels = Partial<Record<'codex' | 'claude-code', string>>;

export function parseGroupDefaultModels(raw: unknown): GroupDefaultModels {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('default_models_must_be_object');
  }
  const models: GroupDefaultModels = {};
  for (const [cli, value] of Object.entries(raw)) {
    if (cli !== 'codex' && cli !== 'claude-code') throw new Error('unsupported_model_cli');
    if (typeof value !== 'string' || value.length > 200 || /[\x00-\x1f\x7f]/.test(value)) {
      throw new Error('invalid_model');
    }
    if (value.trim()) models[cli] = value.trim();
  }
  return models;
}

/** Ignore invalid hand-edited entries without dropping other groups. */
export function normalizeGroupDefaultModels(raw: unknown): Record<string, GroupDefaultModels> {
  const groups: Record<string, GroupDefaultModels> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return groups;
  for (const [chatId, value] of Object.entries(raw)) {
    if (!/^oc_[a-zA-Z0-9_-]+$/.test(chatId)) continue;
    try {
      const models = parseGroupDefaultModels(value);
      if (Object.keys(models).length) groups[chatId] = models;
    } catch { /* Invalid config is not a launch argument. */ }
  }
  return groups;
}
