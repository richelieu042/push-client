<script setup lang="ts">
import {WebSocketClient} from "@/_internal/ws/WebSocketClient";
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {Console} from "@/_internal/utils/Console";
import {Key} from "@/_internal/consts/key";

let initialUrl = LocalStorageUtil.getWsUrl(),
    initialPushMessageType = LocalStorageUtil.getWsPushMessageType();

let url = ref(initialUrl),
    pushMessageType = ref(initialPushMessageType),
    message = ref("");

watch(pushMessageType, (newVal, oldVal) => {
  Console.println(`${Key.WsPushMessageType} is changed: ${oldVal} -> ${newVal}`);
  LocalStorageUtil.setWsPushMessageType(newVal);
});

onMounted(() => {
  Console.println(`[WebSocket] initial url: ${initialUrl}`);
  Console.println(`[WebSocket] initial push message type: ${initialPushMessageType}`);
});

onBeforeUnmount(() => WebSocketClient.disconnect(true));

function connect(event: Event) {
  WebSocketClient.connect(url.value, Number(pushMessageType.value));
}

function disconnect(event: Event) {
  WebSocketClient.disconnect();
}

function send(event: Event) {
  WebSocketClient.send(message.value);
}
</script>

<template>
  <div>
    ws push type:
    <select v-model="pushMessageType">
      <option :value="0">text || binary(no compress) || binary(gzip)</option>
      <option :value="1">binary(brotli)</option>
    </select>
  </div>
  <div>
    ws url:
    <br>
    <input v-model="url" type="text" style="width: 1200px" placeholder="以 ws:// 或 wss:// 开头...">
    <br>
    <button @click="connect($event)">Connect</button>
    <button class="margin-left" @click="disconnect($event)">Disconnect</button>
  </div>

  <br>
  <div>
    message:
    <br>
    <textarea v-model="message" style="width: 1200px; height: 60px"></textarea>
    <br>
    <button @click="send($event)">Send</button>
  </div>
  <br>
</template>

<style scoped>

</style>
