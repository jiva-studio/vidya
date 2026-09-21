import { describe, expect, it } from 'vitest'
import { defineComponent, h, Teleport } from 'vue'

import { mountWithApp } from '../mount'

const Overlaid = defineComponent({
  setup: () => () => h(Teleport, { to: 'body' }, [h('div', 'the overlay')]),
})

/**
 * A screen that outlives its test keeps writing into a document the next test
 * has already cleared, and Vue throws where no test can catch it.
 */
describe('a screen mounted by a test', () => {
  it('puts its overlay in the document', () => {
    mountWithApp(Overlaid)

    expect(document.body.textContent).toContain('the overlay')
  })

  it('takes the overlay with it when the test that mounted it ends', () => {
    expect(document.body.textContent).not.toContain('the overlay')
  })
})
