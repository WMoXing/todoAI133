<template>
  <AppLayout>
    <ChatPanel :full-screen="true" />
  </AppLayout>
</template>

<script setup>
import AppLayout from '../components/layout/AppLayout.vue'
import ChatPanel from '../components/ai/ChatPanel.vue'
</script>
