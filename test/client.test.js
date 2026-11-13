import assert from 'node:assert/strict'
import test from 'node:test'

test('bundle config form renders without the owner form prop', async () => {
  const captured = []
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [initial, () => {}],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  const fakeForm = {
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready', value: {}, revision: 0 }),
    mutate: async () => true,
  }

  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        const mod = definition.factory(() => fakeReact)
        const ctx = {
          effect: fn => fn(),
          locale: { register: () => () => {} },
          configForms: { get: () => fakeForm },
          slots: {
            inject: (_name, callback) => callback(),
            register: (options, component) => {
              captured.push({ options, component })
              return () => {}
            },
          },
        }
        mod.apply(ctx)
      },
    },
  }

  await import('../client.js')

  assert.deepEqual(
    captured.map(entry => `${entry.options.name}:${entry.options.key}`),
    ['plugins.bundle.config:dsh-free-search-mini'],
  )

  // The bundle slot receives no `form` prop from the Plugins page; the
  // component must obtain the configForms controller itself.
  const tree = captured[0].component({ view: 'page', t: key => key })
  assert.equal(tree.type, 'div')
  assert.notEqual(tree.props.children[0].props.children, 'Configuration is unavailable in this profile.')

  // The secret field is never sent back to the browser, so configured state is
  // unknown here. The clear action must still be offered.
  const buttonLabels = []
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return
    if (node.type === 'button') buttonLabels.push(...node.props.children.filter(child => typeof child === 'string'))
    for (const child of node.props.children ?? []) walk(child)
  }
  walk(tree)
  assert.ok(buttonLabels.includes('clear'))
})
