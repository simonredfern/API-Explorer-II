
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ChatMessage from '../components/ChatMessage.vue'

describe('ChatMessage', () => {
  it('should render correctly on human message', () => {
    const humanMessage = JSON.parse(`{
                    "messages": [
                      {
                        "content": "Hello Opey!",
                        "additional_kwargs": {},
                        "response_metadata": {},
                        "type": "human",
                        "id": "ed614658-22a3-40a3-b403-bc790b941a9a",
                        "example": false
                      }
                    ]
                  }`)
    const wrapper = mount(ChatMessage, {
      props: {
        message: humanMessage
      }
    })

    expect(wrapper.text()).toContain('Hello Opey!')
    expect(wrapper.html()).toMatchSnapshot()
  })
})

