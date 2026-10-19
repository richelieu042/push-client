<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {Console} from "@/_internal/utils/Console";
import {Key} from "@/_internal/consts/key";
import {SseClient} from "@/_internal/sse/SseClient";

let initialUrl = LocalStorageUtil.getSseUrl(),
    initialPushMessageType = LocalStorageUtil.getSsePushMessageType();

let url = ref(initialUrl),
    pushMessageType = ref(initialPushMessageType);

watch(pushMessageType, (newVal, oldVal) => {
  Console.println(`${Key.SsePushMessageType} is changed: ${oldVal} -> ${newVal}`);
  LocalStorageUtil.setSsePushMessageType(newVal);
});

onMounted(() => {
  Console.println(`[SSE] initial url: ${initialUrl}`);
  Console.println(`[SSE] initial push message type: ${initialPushMessageType}`);
});

function connect(event: Event) {
  SseClient.connect(url.value, Number(pushMessageType.value));
}

onBeforeUnmount(() => SseClient.disconnect());

function disconnect(event: Event) {
  SseClient.disconnect();
}
</script>

<template>
  <div>
    sse push type:
    <select v-model="pushMessageType">
      <option :value="0">raw</option>
      <option :value="1">base64</option>
    </select>
  </div>
  <div>
    sse url:
    <br>
    <input v-model="url" type="text" style="width: 1200px" placeholder="以 http:// 或 https:// 开头...">
    <br>
    <button @click="connect($event)">Connect</button>
    <button class="margin-left" @click="disconnect($event)">Disconnect</button>
  </div>
</template>

<style scoped>

</style>
