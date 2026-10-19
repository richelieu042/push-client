<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import type {TransportEndpoint, TransportName} from "centrifuge";
import {CentrifugeClient} from "@/_internal/centrifuge/CentrifugeClient";
import {Console} from "@/_internal/utils/Console";

const transports: TransportName[] = ["websocket", "sse", "http_stream"];
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

function channelBlur() {
  LocalStorageUtil.setCentrifugeChannel(CentrifugeClient.channel);
}

async function connect() {
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
    <select v-model="CentrifugeClient.debug" class="margin-left" @change="debugChange">
      <option :value="false">false</option>
      <option :value="true">true</option>
    </select>
    <br>

    protocol:
    <select v-model="CentrifugeClient.protocol" class="margin-left" @change="protocolChange">
      <option value="json">JSON</option>
      <option value="protobuf">Protobuf binary</option>
    </select>
    <br>

    token_hmac_secret_key:
    <input v-model="CentrifugeClient.secret" class="margin-left text-input" placeholder="mustn't be empty"
           type="text"
           @blur="secretBlur">
    <br>

    user:
    <input v-model="CentrifugeClient.user" class="margin-left text-input" placeholder="use UUIDv4 if empty"
           type="text"
           @blur="userBlur">
    <br>

    channel:
    <input v-model="CentrifugeClient.channel" class="margin-left text-input" placeholder="mustn't be empty"
           type="text"
           @blur="channelBlur">
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
    <input v-model="CentrifugeClient.rpcMethod" class="margin-left text-input" type="text"
           @change="rpcMethodChanged">
    <br>
    rpc data(json string):
    <input v-model="CentrifugeClient.rpcData" class="margin-left text-input" type="text"
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
