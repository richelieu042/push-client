<script setup lang="ts">
import {defineAsyncComponent, ref, watch} from 'vue';
import {Console} from "@/_internal/utils/Console";
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {Key} from "@/_internal/consts/key";

const WebSocket = defineAsyncComponent(() => import("@/components/WebSocket.vue"));
const SSE = defineAsyncComponent(() => import("@/components/SSE.vue"));
const Centrifuge = defineAsyncComponent(() => import("@/components/Centrifuge.vue"));

/* Console */
let output = ref("");
Console.initialize(output);

function clear(event: Event) {
  Console.clear();
}

let connectionType = ref(LocalStorageUtil.getConnectionType());
watch(connectionType, (newVal, oldVal) => {
  Console.clear();

  Console.println(`${Key.ConnectionType} is changed: ${oldVal} -> ${newVal}`);
  LocalStorageUtil.setConnectionType(newVal);
});
</script>

<template>
  <div>
    type of long connection:
    <select v-model="connectionType">
      <option :value="0">WebSocket</option>
      <option :value="1">SSE</option>
      <option :value="2">Centrifuge</option>
    </select>
  </div>
  <div>
    output:
    <br>
    <textarea :value="output" readonly style="width: 1600px; height: 380px"></textarea>
    <br>
    <button @click="clear($event)">Clear</button>
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

</style>
