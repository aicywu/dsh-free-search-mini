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
      hint: 'Optional. Without a key the tool uses Bing RSS, DuckDuckGo HTML and Wikipedia. Leave blank to keep an existing key.',
      placeholder: 'fc-...',
      configured: 'A Firecrawl key is configured.',
      notConfigured: 'No Firecrawl key is configured; free engines are used.',
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
      hint: '可选。不填时使用 Bing RSS、DuckDuckGo HTML 和 Wikipedia。留空表示保持已有 Key 不变。',
      placeholder: 'fc-...',
      configured: '已配置 Firecrawl Key。',
      notConfigured: '尚未配置 Firecrawl Key，将使用免费引擎。',
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
        const [draft, setDraft] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [message, setMessage] = React.useState('')

        const hasKey = typeof snapshot?.value?.firecrawlApiKey === 'string'
          && snapshot.value.firecrawlApiKey.length > 0

        if (view === 'summary') return h('span', null, t('summary'))
        if (snapshot?.status === 'unavailable') return h('p', null, t('unavailable'))
        if (snapshot?.status === 'loading') return h('p', null, t('loading'))

        async function save() {
          if (draft.trim().length === 0) {
            setMessage(t('hint'))
            return
          }
          setBusy(true)
          setMessage('')
          try {
            const ok = await configForm.mutate(
              [{ op: 'set', path: ['firecrawlApiKey'], value: draft.trim() }],
              snapshot.revision,
            )
            setMessage(ok ? t('saved') : t('saveFailed'))
            if (ok) setDraft('')
          } catch {
            setMessage(t('saveFailed'))
          } finally {
            setBusy(false)
          }
        }

        async function clear() {
          setBusy(true)
          setMessage('')
          try {
            const ok = await configForm.mutate(
              [{ op: 'unset', path: ['firecrawlApiKey'] }],
              snapshot.revision,
            )
            setMessage(ok ? t('cleared') : t('saveFailed'))
          } catch {
            setMessage(t('saveFailed'))
          } finally {
            setBusy(false)
          }
        }

        return h('div', { style: { padding: '4px 0' } },
          h('div', { style: { fontWeight: 600, marginBottom: 4 } }, t('title')),
          h('p', { style: { margin: '0 0 8px', opacity: 0.75, fontSize: 13 } }, t('hint')),
          h('p', { style: { margin: '0 0 8px', fontSize: 13 } }, hasKey ? t('configured') : t('notConfigured')),
          h('input', {
            type: 'password',
            value: draft,
            placeholder: t('placeholder'),
            autoComplete: 'off',
            spellCheck: false,
            style: inputStyle,
            onChange: event => { setDraft(event.target.value); setMessage('') },
            onKeyDown: event => { if (event.key === 'Enter') void save() },
          }),
          h('div', null,
            h('button', { type: 'button', style: buttonStyle, disabled: busy, onClick: save }, busy ? t('saving') : t('save')),
            hasKey ? h('button', { type: 'button', style: buttonStyle, disabled: busy, onClick: clear }, t('clear')) : null,
          ),
          message.length > 0 ? h('p', { style: { margin: '8px 0 0', fontSize: 13, opacity: 0.75 } }, message) : null,
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
