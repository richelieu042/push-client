<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/internal/utils/LocalStorageUtil";
import type {TransportEndpoint, TransportName} from "centrifuge";
import {CentrifugeClient} from "@/internal/centrifuge/CentrifugeClient";
import {Console} from "@/internal/utils/Console";
import {submitOnEnter} from "@/internal/utils/Keyboard";
import {HMAC_ALGORITHMS} from "@/internal/consts/jwt";

const transports: TransportName[] = ["websocket", "sse", "http_stream"];
let nextChannelId = 0;
const channels = ref(CentrifugeClient.channels.map(value => ({id: nextChannelId++, value})));
watch(channels, saveChannels, {deep: true});

const alternatives = ref([
  {
    type: LocalStorageUtil.getCentrifugeAlternative0Type(),
    url: LocalStorageUtil.getCentrifugeAlternative0Url(),
    saveType: LocalStorageUtil.setCentrifugeAlternative0Type,
    saveUrl: LocalStorageUtil.setCentrifugeAlternative0Url,
  },
  {
    type: LocalStorageUtil.getCentrifugeAlternative1Type(),
    url: LocalStorageUtil.getCentrifugeAlternative1Url(),
    saveType: LocalStorageUtil.setCentrifugeAlternative1Type,
    saveUrl: LocalStorageUtil.setCentrifugeAlternative1Url,
  },
  {
    type: LocalStorageUtil.getCentrifugeAlternative2Type(),
    url: LocalStorageUtil.getCentrifugeAlternative2Url(),
    saveType: LocalStorageUtil.setCentrifugeAlternative2Type,
    saveUrl: LocalStorageUtil.setCentrifugeAlternative2Url,
  },
]);

onBeforeUnmount(() => {
  CentrifugeClient.disconnect(false);
});

function resetConnection() {
  CentrifugeClient.disconnect(false);
  Console.clear();
}

alternatives.value.forEach(alternative => {
  watch(() => alternative.type, value => {
    resetConnection();
    alternative.saveType(value);
  });
});

function debugChange() {
  resetConnection();
  LocalStorageUtil.setCentrifugeDebug(CentrifugeClient.debug);
}

function protocolChange() {
  resetConnection();
  LocalStorageUtil.setCentrifugeProtocol(CentrifugeClient.protocol);
}

function algorithmChange() {
  LocalStorageUtil.setCentrifugeAlgorithm(CentrifugeClient.algorithm);
}

function rpcMethodChanged() {
  LocalStorageUtil.setCentrifugeRpcMethod(CentrifugeClient.rpcMethod);
}

function rpcDataChanged() {
  LocalStorageUtil.setCentrifugeRpcData(CentrifugeClient.rpcData);
}

function secretBlur() {
  LocalStorageUtil.setCentrifugeSecret(CentrifugeClient.secret);
}

function userBlur() {
  LocalStorageUtil.setCentrifugeUser(CentrifugeClient.user);
}

function saveChannels() {
  CentrifugeClient.channels = channels.value.map(channel => channel.value);
  LocalStorageUtil.setCentrifugeChannels(CentrifugeClient.channels);
}

function addChannel() {
  channels.value.push({id: nextChannelId++, value: ""});
}

function removeChannel(index: number) {
  if (channels.value.length > 1) {
    channels.value.splice(index, 1);
  }
}

async function connect() {
  saveChannels();
  for (const alternative of alternatives.value) {
    alternative.url = alternative.url.trim();
    alternative.saveUrl(alternative.url);
  }

  Console.clear();

  const endpoints: TransportEndpoint[] = [];
  for (const [index, alternative] of alternatives.value.entries()) {
    if (!alternative.type || !alternative.url) {
      continue;
    }
    const transport = transports.find(value => value === alternative.type);
    if (!transport || !CentrifugeClient.checkUrl(alternative.url, transport)) {
      alert(`invalid alternative${index}Url: ${alternative.url}`);
      return;
    }
    endpoints.push({
      transport,
      endpoint: alternative.url,
    });
  }

  await CentrifugeClient.connect(endpoints);
}

function disconnect() {
  CentrifugeClient.disconnect();
}

function sendRPC() {
  return CentrifugeClient.rpc();
}
</script>

<template>
  <div>
    debug:
    <select v-model="CentrifugeClient.debug" class="margin-left" aria-label="Centrifuge debug" @change="debugChange">
      <option :value="false">false</option>
      <option :value="true">true</option>
    </select>
    <br>

    protocol:
    <select v-model="CentrifugeClient.protocol" class="margin-left" aria-label="Centrifuge protocol" @change="protocolChange">
      <option value="json">JSON</option>
      <option value="protobuf">Protobuf binary</option>
    </select>
    <br>

    token_algorithm:
    <select v-model="CentrifugeClient.algorithm" class="margin-left" aria-label="Centrifuge token algorithm" @change="algorithmChange">
      <option v-for="algorithm in HMAC_ALGORITHMS" :key="algorithm" :value="algorithm">{{ algorithm }}</option>
    </select>
    <br>

    token_hmac_secret_key:
    <input v-model="CentrifugeClient.secret" class="margin-left text-input" placeholder="mustn't be empty"
           type="text" aria-label="Centrifuge token secret" spellcheck="false" autocapitalize="off"
           @blur="secretBlur">
    <br>

    user:
    <input v-model="CentrifugeClient.user" class="margin-left text-input" placeholder="use UUIDv4 if empty"
           type="text" aria-label="Centrifuge user" spellcheck="false" autocapitalize="off"
           @blur="userBlur">
    <br>

    <div class="channels">
      <div class="channel-heading">
        channels:
        <button type="button" @click="addChannel">Add channel</button>
      </div>
      <div v-for="(channel, index) in channels" :key="channel.id" class="channel-row">
        <input v-model="channel.value" class="text-input" placeholder="channel name"
               type="text" :aria-label="`Centrifuge channel ${index + 1}`" spellcheck="false" autocapitalize="off"
               @keydown="submitOnEnter($event, connect)">
        <button type="button" :disabled="channels.length === 1" :aria-label="`Remove channel ${index + 1}`"
                @click="removeChannel(index)">Remove</button>
      </div>
      <small>Connect subscribes to all channels. Empty rows are ignored; duplicates are subscribed once.</small>
    </div>
  </div>

  <div class="transport-endpoints">
    TransportEndpoints(default endpoint of Bidirectional WebSocket: ws://localhost:8000/connection/websocket):
    <br>
    <div v-for="(alternative, index) in alternatives" :key="index" class="endpoint-row">
      <select v-model="alternative.type" :aria-label="`alternative${index} type`">
        <option value="">null</option>
        <option v-for="transport in transports" :key="transport" :value="transport">{{ transport }}</option>
      </select>
      <input v-model="alternative.url" type="text" :aria-label="`alternative${index} URL`"
             spellcheck="false" autocapitalize="off" @keydown="submitOnEnter($event, connect)"
             @blur="alternative.saveUrl(alternative.url)">
    </div>
  </div>
  <div>
    <button @click="connect">Connect</button>
    <button class="margin-left" @click="disconnect">Disconnect</button>
  </div>
  <br>

  <div>
    rpc method:
    <input v-model="CentrifugeClient.rpcMethod" class="margin-left text-input" type="text" aria-label="RPC method"
           spellcheck="false" autocapitalize="off"
           @change="rpcMethodChanged">
    <br>
    rpc data(json string):
    <input v-model="CentrifugeClient.rpcData" class="margin-left text-input" type="text" aria-label="RPC JSON data"
           spellcheck="false" autocapitalize="off"
           @change="rpcDataChanged">
    <br>
    <button @click="sendRPC">Send RPC</button>
  </div>
  <br>
</template>

<style scoped>
.text-input {
  width: 600px;
}

.channel-heading,
.channel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.channel-row {
  max-width: 750px;
}

.channel-row input {
  flex: 1;
  min-width: 0;
}

.channel-row button {
  flex-shrink: 0;
}

.transport-endpoints {
  overflow-wrap: anywhere;
}

.endpoint-row {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 750px;
}

.endpoint-row select {
  width: 140px;
  flex-shrink: 0;
}

.endpoint-row input {
  flex: 1;
  min-width: 0;
}
</style>
