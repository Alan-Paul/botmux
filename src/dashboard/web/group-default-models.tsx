import React, { useEffect, useRef, useState } from 'react';
import type { GroupDefaultModels } from '../../core/group-default-models.js';

/** One independent configuration row per bot in the selected group. */
export function GroupDefaultModelsRow(props: {
  chatId: string;
  appId: string;
  botName: string;
  models?: GroupDefaultModels;
  disabled?: boolean;
  onSaved(): Promise<unknown>;
}) {
  const [models, setModels] = useState<GroupDefaultModels>(props.models ?? {});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const dirty = useRef(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!dirty.current && !savingRef.current) setModels(props.models ?? {});
  }, [props.models]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current || props.disabled) return;
    savingRef.current = true;
    setSaving(true);
    setStatus('保存中…');
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(props.chatId)}/default-models/${encodeURIComponent(props.appId)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(models),
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true) throw new Error(body.error || body.reason || `HTTP ${response.status}`);
      dirty.current = false;
      setModels(body.models);
      setStatus('已保存，仅对新话题生效');
      try { await props.onSaved(); }
      catch { setStatus('已保存，列表刷新失败，请刷新页面确认'); }
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <form onSubmit={save} className="group-default-models-row">
    <strong>{props.botName}</strong>
    {(['codex', 'claude-code'] as const).map(cli => <label key={cli}>
      <span>{cli === 'codex' ? 'Codex' : 'Claude'}</span>
      <input aria-label={`${props.botName} ${cli === 'codex' ? 'Codex' : 'Claude'} 默认模型`}
        value={models[cli] ?? ''} maxLength={200} placeholder="留空继承 Bot 默认模型"
        disabled={props.disabled || saving}
        onChange={event => { dirty.current = true; setModels({ ...models, [cli]: event.currentTarget.value }); }} />
    </label>)}
    <button type="submit" disabled={props.disabled || saving}>保存</button>
    <small role="status">{status}</small>
  </form>;
}
