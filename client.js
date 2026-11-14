/**
 * Browser half of dsh-free-search-mini.
 *
 * The bundle page is the single place to configure the optional Firecrawl key.
 * Its slot does not receive a `form` prop from the page, so this module reads
 * the plugin's `free-search-mini` entry through `configForms` itself and writes
 * through the ordinary settings/document path.
 */

window.__ModuleLoader__.load({
  id: 'dsh-free-search-mini',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const en = {
      summary: 'Optional Firecrawl API key',
      title: 'Firecrawl API key',
      hint: 'Optional. Without a key the tool tries Firecrawl keyless first, then Tavily, Bing RSS, DuckDuckGo HTML and Wikipedia. Leave blank to keep an existing key.',
      tavilyTitle: 'Tavily API key',
      tavilyHint: 'Optional. Without a key the tool tries Tavily keyless first. Keyless has a daily quota; when it is exhausted the tool falls back to other engines.',
      placeholder: 'fc-... / tvly-...',
      statusHint: 'Keys are write-only: leaving a field blank keeps an existing key; Clear removes it.',
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved.',
      saveFailed: 'Save failed.',
      clear: 'Clear key',
      cleared: 'Key cleared.',
      loading: 'Loading configuration...',
      unavailable: 'Configuration is unavailable in this profile.',
    }
    const zh = {
      summary: '可选的 Firecrawl API Key',
      title: 'Firecrawl API Key',
      hint: '可选。不填时先尝试 Firecrawl keyless，再依次尝试 Tavily、Bing RSS、DuckDuckGo HTML 和 Wikipedia。留空表示保持已有 Key 不变。',
      tavilyTitle: 'Tavily API Key',
      tavilyHint: '可选。不填时先尝试 Tavily keyless；keyless 有每日额度，用完会自动回退到其他引擎。',
      placeholder: 'fc-... / tvly-...',
      statusHint: 'Key 保存后不会回显：留空保存会保留已有 Key，点“清除 Key”可删除。',
      save: '保存',
      saving: '保存中...',
      saved: '已保存。',
      saveFailed: '保存失败。',
      clear: '清除 Key',
      cleared: 'Key 已清除。',
      loading: '正在读取配置...',
      unavailable: '当前 profile 无法保存配置。',
    }

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '7px 9px',
      borderRadius: 6,
      border: '1px solid rgba(127,127,127,.35)',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
    }
    const buttonStyle = {
      marginTop: 8,
      marginRight: 8,
      padding: '6px 14px',
      borderRadius: 6,
      border: '1px solid rgba(127,127,127,.35)',
      background: 'rgba(76,141,255,.12)',
      color: 'inherit',
      cursor: 'pointer',
    }

    function useFormSnapshot(form) {
      return React.useSyncExternalStore(
        listener => form.subscribe(listener),
        () => form.getSnapshot(),
        () => form.getSnapshot(),
      )
    }

    function makeSettings(configForm) {
      return function FreeSearchSettings({ view, t = key => key }) {
        const snapshot = useFormSnapshot(configForm)
        // Fixed hook order: one draft, busy flag and message map shared by both
        // key fields. The fields are rendered as plain elements (not child
        // components) so the whole form stays in one component.
        const [firecrawlDraft, setFirecrawlDraft] = React.useState('')
        const [tavilyDraft, setTavilyDraft] = React.useState('')
        const [busy, setBusy] = React.useState('')
        const [messages, setMessages] = React.useState({})

        if (view === 'summary') return h('span', null, t('summary'))
        if (snapshot?.status === 'unavailable') return h('p', null, t('unavailable'))
        if (snapshot?.status === 'loading') return h('p', null, t('loading'))

        const revision = snapshot?.revision
        const setFieldMessage = (field, text) => setMessages(previous => ({ ...previous, [field]: text }))

        async function save(field, draft, clearDraft) {
          if (draft.trim().length === 0) {
            setFieldMessage(field, t('hint'))
            return
          }
          setBusy(field)
          setFieldMessage(field, '')
          try {
            const ok = await configForm.mutate(
              [{ op: 'set', path: [field], value: draft.trim() }],
              revision,
            )
            setFieldMessage(field, ok ? t('saved') : t('saveFailed'))
            if (ok) clearDraft('')
          } catch {
            setFieldMessage(field, t('saveFailed'))
          } finally {
            setBusy('')
          }
        }

        async function clear(field) {
          setBusy(field)
          setFieldMessage(field, '')
          try {
            const ok = await configForm.mutate(
              [{ op: 'unset', path: [field] }],
              revision,
            )
            setFieldMessage(field, ok ? t('cleared') : t('saveFailed'))
          } catch {
            setFieldMessage(field, t('saveFailed'))
          } finally {
            setBusy('')
          }
        }

        function renderKeyField(field, title, hint, draft, setDraft) {
          const isBusy = busy === field
          const message = messages[field] ?? ''
          return h('div', { key: field, style: { padding: '4px 0 18px' } },
            h('div', { style: { fontWeight: 600, marginBottom: 4 } }, title),
            h('p', { style: { margin: '0 0 8px', opacity: 0.75, fontSize: 13 } }, hint),
            h('p', { style: { margin: '0 0 8px', opacity: 0.75, fontSize: 13 } }, t('statusHint')),
            h('input', {
              name: field,
              type: 'password',
              value: draft,
              placeholder: t('placeholder'),
              autoComplete: 'off',
              spellCheck: false,
              style: inputStyle,
              onChange: event => { setDraft(event.target.value); setFieldMessage(field, '') },
              onKeyDown: event => { if (event.key === 'Enter') void save(field, draft, setDraft) },
            }),
            h('div', null,
              h('button', { type: 'button', style: buttonStyle, disabled: isBusy, onClick: () => save(field, draft, setDraft) }, isBusy ? t('saving') : t('save')),
              h('button', { type: 'button', style: buttonStyle, disabled: isBusy, onClick: () => clear(field) }, t('clear')),
            ),
            message.length > 0 ? h('p', { style: { margin: '8px 0 0', fontSize: 13, opacity: 0.75 } }, message) : null,
          )
        }

        return h('div', { style: { padding: '4px 0' } },
          renderKeyField('firecrawlApiKey', t('title'), t('hint'), firecrawlDraft, setFirecrawlDraft),
          renderKeyField('tavilyApiKey', t('tavilyTitle'), t('tavilyHint'), tavilyDraft, setTavilyDraft),
        )
      }
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('freeSearchMini', { en, zh }), 'free-search-mini: locale')
        const configForm = ctx.configForms.get('free-search-mini')
        const FreeSearchSettings = makeSettings(configForm)
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: 'dsh-free-search-mini',
          locale: 'freeSearchMini',
        }, FreeSearchSettings))
      },
    }
  },
})
