<script setup lang="ts">
import {WebSocketClient} from "@/_internal/ws/WebSocketClient";
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {Console} from "@/_internal/utils/Console";
import {Key} from "@/_internal/consts/key";
import {submitOnEnter} from "@/_internal/utils/Keyboard";

const initialUrl = LocalStorageUtil.getWsUrl();
const initialPushMessageType = LocalStorageUtil.getWsPushMessageType();

const url = ref(initialUrl);
const pushMessageType = ref(initialPushMessageType);
const message = ref("");

watch(pushMessageType, (newVal, oldVal) => {
  Console.println(`${Key.WsPushMessageType} is changed: ${oldVal} -> ${newVal}`);
  LocalStorageUtil.setWsPushMessageType(newVal);
});

onMounted(() => {
  Console.println(`[WebSocket] initial url: ${initialUrl}`);
  Console.println(`[WebSocket] initial push message type: ${initialPushMessageType}`);
});

onBeforeUnmount(() => WebSocketClient.disconnect(true));

function connect() {
  url.value = url.value.trim();
  WebSocketClient.connect(url.value, Number(pushMessageType.value));
}

function disconnect() {
  WebSocketClient.disconnect();
}

function send() {
  WebSocketClient.send(message.value);
}
</script>

<template>
  <div>
    ws push type:
    <select v-model="pushMessageType" aria-label="WebSocket push type">
      <option :value="0">text || binary(no compress) || binary(gzip)</option>
      <option :value="1">binary(brotli)</option>
    </select>
  </div>
  <div>
    ws url:
    <br>
    <input v-model="url" class="wide-input" type="text" aria-label="WebSocket URL"
           spellcheck="false" autocapitalize="off" placeholder="以 ws:// 或 wss:// 开头..." @keydown="submitOnEnter($event, connect)">
    <br>
    <button @click="connect">Connect</button>
    <button class="margin-left" @click="disconnect">Disconnect</button>
  </div>

  <br>
  <div>
    message:
    <br>
    <textarea v-model="message" class="wide-input message-input" aria-label="WebSocket message" spellcheck="false"></textarea>
    <br>
    <button @click="send">Send</button>
  </div>
  <br>
</template>

<style scoped>
.message-input {
  height: 60px;
}
</style>
