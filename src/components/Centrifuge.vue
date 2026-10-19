<script setup lang="ts">
import isEmpty from "lodash/isEmpty.js";
import {onBeforeUnmount, ref, watch} from 'vue';
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import type {TransportEndpoint, TransportName} from "centrifuge";
import {CentrifugeClient} from "@/_internal/centrifuge/CentrifugeClient";
import {Console} from "@/_internal/utils/Console";

let alternative0Type = ref(LocalStorageUtil.getCentrifugeAlternative0Type()),
    alternative0Url = ref(LocalStorageUtil.getCentrifugeAlternative0Url()),
    alternative1Type = ref(LocalStorageUtil.getCentrifugeAlternative1Type()),
    alternative1Url = ref(LocalStorageUtil.getCentrifugeAlternative1Url()),
    alternative2Type = ref(LocalStorageUtil.getCentrifugeAlternative2Type()),
    alternative2Url = ref(LocalStorageUtil.getCentrifugeAlternative2Url());

onBeforeUnmount(() => {
  CentrifugeClient.disconnect(false);
});

watch(alternative0Type, (newVal, oldVal) => {
  CentrifugeClient.disconnect(false);
  Console.clear();

  LocalStorageUtil.setCentrifugeAlternative0Type(newVal);
});
watch(alternative1Type, (newVal, oldVal) => {
  CentrifugeClient.disconnect(false);
  Console.clear();

  LocalStorageUtil.setCentrifugeAlternative1Type(newVal);
});
watch(alternative2Type, (newVal, oldVal) => {
  CentrifugeClient.disconnect(false);
  Console.clear();

  LocalStorageUtil.setCentrifugeAlternative2Type(newVal);
});

function debugChange() {
  CentrifugeClient.disconnect(false);
  Console.clear();

  LocalStorageUtil.setCentrifugeDebug(CentrifugeClient.debug);
}

function protocolChange() {
  CentrifugeClient.disconnect(false);
  Console.clear();

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

function alternative0UrlBlur() {
  LocalStorageUtil.setCentrifugeAlternative0Url(alternative0Url.value);
}

function alternative1UrlBlur() {
  LocalStorageUtil.setCentrifugeAlternative1Url(alternative1Url.value);
}

function alternative2UrlBlur() {
  LocalStorageUtil.setCentrifugeAlternative2Url(alternative2Url.value);
}

async function connect(event: Event) {
  Console.clear();

  let endpoints: TransportEndpoint[] = [];

  /* alternative 0 */
  if (!isEmpty(alternative0Type.value) && !isEmpty(alternative0Url.value)) {
    if (!CentrifugeClient.checkUrl(alternative0Url.value)) {
      alert(`invalid alternative0Url: ${alternative0Url.value}`);
      return;
    }
    endpoints.push({
      transport: alternative0Type.value as TransportName,
      endpoint: alternative0Url.value
    });
  }
  /* alternative 1 */
  if (!isEmpty(alternative1Type.value) && !isEmpty(alternative1Url.value)) {
    if (!CentrifugeClient.checkUrl(alternative1Url.value)) {
      alert(`invalid alternative1Url: ${alternative1Url.value}`);
      return;
    }
    endpoints.push({
      transport: alternative1Type.value as TransportName,
      endpoint: alternative1Url.value
    });
  }
  /* alternative 2 */
  if (!isEmpty(alternative2Type.value) && !isEmpty(alternative2Url.value)) {
    if (!CentrifugeClient.checkUrl(alternative2Url.value)) {
      alert(`invalid alternative2Url: ${alternative2Url.value}`);
      return;
    }
    endpoints.push({
      transport: alternative2Type.value as TransportName,
      endpoint: alternative2Url.value
    });
  }

  await CentrifugeClient.connect(endpoints);
}

function disconnect(event: Event) {
  CentrifugeClient.disconnect();
}

function sendRPC(event: Event) {
  CentrifugeClient.rpc();
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
    <input v-model="CentrifugeClient.secret" class="margin-left" placeholder="mustn't be empty" style="width: 600px"
           type="text"
           @blur="secretBlur">
    <br>

    user:
    <input v-model="CentrifugeClient.user" class="margin-left" placeholder="use UUIDv4 if empty" style="width: 600px"
           type="text"
           @blur="userBlur">
    <br>

    channel:
    <input v-model="CentrifugeClient.channel" class="margin-left" placeholder="mustn't be empty" style="width: 600px"
           type="text"
           @blur="channelBlur">
  </div>

  <div>
    TransportEndpoints(default endpoint of Bidirectional WebSocket: ws://localhost:8000/connection/websocket):
    <br>
    <!-- 可选项0 -->
    <div>
      <select v-model="alternative0Type" style="width: 140px">
        <option value="">null</option>
        <option value="websocket">websocket</option>
        <option value="sse">sse</option>
        <option value="http_stream">http_stream</option>
      </select>
      <input v-model="alternative0Url" class="margin-left" style="width: 600px" type="text" @blur="alternative0UrlBlur">
    </div>
    <!-- 可选项1 -->
    <div>
      <select v-model="alternative1Type" style="width: 140px">
        <option value="">null</option>
        <option value="websocket">websocket</option>
        <option value="sse">sse</option>
        <option value="http_stream">http_stream</option>
      </select>
      <input v-model="alternative1Url" class="margin-left" style="width: 600px" type="text" @blur="alternative1UrlBlur">
    </div>
    <!-- 可选项2 -->
    <div>
      <select v-model="alternative2Type" style="width: 140px">
        <option value="">null</option>
        <option value="websocket">websocket</option>
        <option value="sse">sse</option>
        <option value="http_stream">http_stream</option>
      </select>
      <input v-model="alternative2Url" class="margin-left" style="width: 600px" type="text" @blur="alternative2UrlBlur">
    </div>
  </div>
  <div>
    <button @click="connect($event)">Connect</button>
    <button class="margin-left" @click="disconnect($event)">Disconnect</button>
  </div>
  <br>

  <div>
    rpc method:
    <input v-model="CentrifugeClient.rpcMethod" class="margin-left" style="width: 600px" type="text"
           @change="rpcMethodChanged">
    <br>
    rpc data(json string):
    <input v-model="CentrifugeClient.rpcData" class="margin-left" style="width: 600px" type="text"
           @change="rpcDataChanged">
    <br>
    <button @click="sendRPC($event)">Send RPC</button>
  </div>
  <br>
</template>

<style scoped>

</style>
