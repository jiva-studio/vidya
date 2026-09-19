<script setup lang="ts">
import { Input, Textarea } from '@vidya/ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import type { SortableEvent } from 'sortablejs'
import { computed, nextTick, ref, watch } from 'vue'

import type { MoveDirection } from '../types'
import {
  addAnswer,
  insertAnswer,
  moveAnswer,
  removeAnswer,
  setAnswer,
  setExplanation,
  setQuestion,
  setRightAnswer,
} from '../model'
import QuizAnswerRow from './QuizAnswerRow.vue'
import {
  answerListClasses,
  explanationClasses,
  newAnswerClasses,
  questionClasses,
  quizClasses,
} from './styles'
import type { AnswerCaret, QuizBlockEditorEmits, QuizBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<QuizBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const answers = computed(() => props.block.answers)
const group = computed(() => `quiz-${props.block.id}`)

const list = ref<HTMLElement | null>(null)
const rows = ref<InstanceType<typeof QuizAnswerRow>[]>([])

// The quiet row below the list; it holds what was typed only until the option
// it became takes over, which is the same tick.
const draft = ref('')

// Where the caret belongs once the list the author changed has been re-rendered.
const landing = ref<{ index: number; caret: AnswerCaret } | null>(null)

// The list is never mutated in place: the drop is reported and the new block
// comes back down as a prop, so the right answer is recomputed in one place.
useSortable(list, answers, {
  disabled: props.frozen,
  handle: '[data-answer-grip]',
  onUpdate: (event: SortableEvent) => onDrop(event.oldIndex, event.newIndex),
})

/* --------------------------------- Hooks ---------------------------------- */

// Post-flush, because the row to focus is one the re-render has just created or
// re-numbered: reading `rows` any earlier addresses the list as it used to be.
watch(() => answers.value.length, land, { flush: 'post' })

/* -------------------------------- Handlers -------------------------------- */

function onQuestion(question: string) {
  emit('update', setQuestion(props.block, question))
}

function onExplanation(explanation: string) {
  emit('update', setExplanation(props.block, explanation))
}

function onAnswerText(index: number, text: string) {
  emit('update', setAnswer(props.block, index, text))
}

function onRight(index: number) {
  emit('update', setRightAnswer(props.block, index))
}

function onRemoveAnswer(index: number) {
  if (answers.value.length <= 1) return
  emit('update', removeAnswer(props.block, index))
}

function onSplit(index: number) {
  landing.value = { index: index + 1, caret: 'start' }
  emit('update', insertAnswer(props.block, index))
}

/** An emptied option gives way, handing the caret to the end of the one above. */
function onCollapse(index: number) {
  if (answers.value.length <= 1) return

  landing.value = { index: Math.max(index - 1, 0), caret: 'end' }
  emit('update', removeAnswer(props.block, index))
}

function onMoveAnswer(index: number, delta: MoveDirection) {
  onDrop(index, index + delta)
}

/** The quiet row is an option the moment it carries anything. */
function onDraft(text: string) {
  const at = answers.value.length
  draft.value = ''
  landing.value = { index: at, caret: 'end' }
  emit('update', setAnswer(addAnswer(props.block), at, text))
}

/* -------------------------------- Helpers --------------------------------- */

/** A reorder leaves the list the same length, so it asks for the re-render itself. */
function onDrop(from?: number, to?: number) {
  if (from === undefined || to === undefined) return
  if (to < 0 || to >= answers.value.length) return

  landing.value = { index: to, caret: 'end' }
  emit('update', moveAnswer(props.block, from, to))
  void nextTick(land)
}

function land() {
  const target = landing.value
  if (!target) return

  landing.value = null
  rows.value[target.index]?.focus(target.caret)
}
</script>

<template>
  <div :class="quizClasses" :data-block-id="props.block.id">
    <Input
      :class="questionClasses"
      :model-value="props.block.question"
      :readonly="props.frozen"
      :placeholder="$t('editor-quiz-question-placeholder')"
      :aria-label="$t('editor-quiz-question-label')"
      @update:model-value="onQuestion"
    />
    <ul ref="list" :class="answerListClasses">
      <QuizAnswerRow
        v-for="(answer, index) in answers"
        :key="`${group}-${index}`"
        ref="rows"
        :name="group"
        :index="index"
        :text="answer"
        :right="index === props.block.rightAnswer"
        :frozen="props.frozen"
        @text="onAnswerText"
        @right="onRight"
        @remove="onRemoveAnswer"
        @split="onSplit"
        @collapse="onCollapse"
        @move="onMoveAnswer"
      />
    </ul>
    <Input
      v-if="!props.frozen"
      :class="newAnswerClasses"
      :model-value="draft"
      :placeholder="$t('editor-quiz-answer-add')"
      :aria-label="$t('editor-quiz-answer-add')"
      @update:model-value="onDraft"
    />
    <Textarea
      :class="explanationClasses"
      :rows="2"
      :model-value="props.block.explanation ?? ''"
      :readonly="props.frozen"
      :placeholder="$t('editor-quiz-explanation-placeholder')"
      :aria-label="$t('editor-quiz-explanation-label')"
      @update:model-value="onExplanation"
    />
  </div>
</template>
