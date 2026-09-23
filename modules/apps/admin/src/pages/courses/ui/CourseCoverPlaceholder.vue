<script setup lang="ts">
defineOptions({
  name: 'CourseCoverPlaceholder',
})

interface Props {
  title?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Cover',
  class: undefined,
})
</script>

<template>
  <div
    class="flex items-center justify-center rounded-md bg-slate-100 border border-slate-200 text-slate-400 select-none overflow-hidden"
    :class="props.class"
    data-test="course-cover-placeholder"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 240"
      class="w-full h-full object-cover"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="100%" height="100%" fill="#f1f5f9" rx="8" />
      <circle cx="200" cy="100" r="36" fill="#e2e8f0" />
      <path d="M120 190 C150 140, 250 140, 280 190" fill="#cbd5e1" />
      <text
        x="200"
        y="215"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="14"
        font-weight="500"
        fill="#64748b"
        text-anchor="middle"
      >
        {{ props.title }}
      </text>
    </svg>
  </div>
</template>
