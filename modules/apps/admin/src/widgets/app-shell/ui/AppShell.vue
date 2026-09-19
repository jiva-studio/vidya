<script setup lang="ts">
import { contentClasses, footerClasses, mainClasses, shellClasses, sidebarClasses } from './styles'
</script>

<template>
  <div :class="shellClasses">
    <aside :class="sidebarClasses">
      <slot name="school" />
      <slot name="nav" />
      <div :class="footerClasses">
        <slot name="profile" />
        <slot name="footer" />
      </div>
    </aside>
    <main :class="mainClasses">
      <div :class="contentClasses">
        <slot />
      </div>
    </main>
  </div>
</template>
