<script setup lang="ts">
import {defineAsyncComponent, onBeforeUnmount, ref, watch} from 'vue';
import {Console} from "@/internal/utils/Console";
import {LocalStorageUtil} from "@/internal/utils/LocalStorageUtil";
import {Key} from "@/internal/consts/key";

const WebSocket = defineAsyncComponent(() => import("@/components/WebSocket.vue"));
const SSE = defineAsyncComponent(() => import("@/components/SSE.vue"));
const Centrifuge = defineAsyncComponent(() => import("@/components/Centrifuge.vue"));

/* Console */
const output = ref("");
const disposeConsole = Console.initialize(output);
onBeforeUnmount(disposeConsole);

function clear() {
  Console.clear();
}

const connectionType = ref(LocalStorageUtil.getConnectionType());
watch(connectionType, (newVal, oldVal) => {
  Console.clear();

  Console.println(`${Key.ConnectionType} is changed: ${oldVal} -> ${newVal}`);
  LocalStorageUtil.setConnectionType(newVal);
});
</script>

<template>
  <div>
    type of long connection:
    <select v-model="connectionType" aria-label="Connection type">
      <option :value="0">WebSocket</option>
      <option :value="1">SSE</option>
      <option :value="2">Centrifuge</option>
    </select>
  </div>
  <div>
    output:
    <br>
    <textarea :value="output" class="console-output" aria-label="Connection output" readonly spellcheck="false"></textarea>
    <br>
    <button @click="clear">Clear</button>
  </div>
  <br>

  <div>
    <WebSocket v-if="connectionType === 0"/>
    <SSE v-else-if="connectionType === 1"/>
    <Centrifuge v-else-if="connectionType === 2"/>
    <h1 v-else>
      invalid connection type: {{ connectionType }}
    </h1>
  </div>
</template>

<style scoped>
.console-output {
  width: 100%;
  max-width: 1600px;
  height: 260px;
}
</style>
