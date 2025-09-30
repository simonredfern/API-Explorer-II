<!--
  - Open Bank Project -  API Explorer II
  - Copyright (C) 2023-2024, TESOBE GmbH
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program.  If not, see <http://www.gnu.org/licenses/>.
  -
  - Email: contact@tesobe.com
  - TESOBE GmbH
  - Osloerstrasse 16/17
  - Berlin 13359, Germany
  -
  -   This product includes software developed at
  -   TESOBE (http://www.tesobe.com/)
  -
  -->

<script setup lang="ts">
import { reactive, ref, onBeforeMount, onMounted, inject, watch } from 'vue'
import { useRoute } from 'vue-router'
import SearchNav from '../components/MessageDocsSearchNav.vue'
import { connectors } from '../obp/message-docs'
import { obpGroupedMessageDocsKey } from '@/obp/keys';
import MessageDocsSearchNav from '../components/MessageDocsSearchNav.vue';
import CodeBlock from '../components/CodeBlock.vue';

let connector = connectors[0]
const route = useRoute()
const groupedMessageDocs = ref(inject(obpGroupedMessageDocsKey)!)
const messageDocs = ref({})

const activeNames = ref(['1', '2', '3', '4', '5', '6'])

onBeforeMount(() => {
  setDoc()
})

watch(
  () => route.params.id,
  async (id) => {
    setDoc()
  }
)

const setDoc = () => {
  const paramConnector = route.params.id
  if (connectors.includes(paramConnector)) {
    connector = paramConnector
  }
  messageDocs.value = groupedMessageDocs.value[connector]
}
function showRequiredFieldInfo(value: any) {
  return (JSON.stringify(value, null) === '{}' || JSON.stringify(value, null) === '')
}
function showDependentEndpoints(value: any) {
  return value.lengtt > 0
}
</script>

<template>
  <el-container class="root">
    <el-aside class="search-nav" width="20%">
      <SearchNav />
    </el-aside>
    <el-main>
      <el-container class="main">
        <div v-for="(group, key) of messageDocs" :key="key">
          <div v-for="(value, key) of group" :key="value">
            <el-divider></el-divider>
            <header>

            </header>
            <a v-bind:href="`#${value.process}`" :id="value.process">
              <h2>{{ value.process }}</h2>
            </a>
            <p>{{ value.description }}</p>

            <section class="topics">
              <div>
                <strong>Outbound Topic: </strong>
                <el-tag type="info" round>{{ value.outbound_topic }}</el-tag>
              </div>
              <div>
                <strong>Inbound Topic: </strong>
                <el-tag type="info" round>{{ value.inbound_topic }}</el-tag>
              </div>
            </section>

            <section>
              <h3>Example Outbound Message</h3>
              <CodeBlock :code="value.example_outbound_message" />
            </section>

            <section>
              <h3>Example Inbound Message</h3>
              <CodeBlock :code="value.example_inbound_message" />
            </section>

            <section v-if="showRequiredFieldInfo(value.requiredFieldInfo)">
              <h3>Required Fields</h3>
              <CodeBlock :code="value.requiredFieldInfo" />
            </section>

            <section v-if="showDependentEndpoints(value.dependent_endpoints)">
              <h3>Dependent Endpoints</h3>
              <ul>
                <li v-for="endpoint in value.dependent_endpoints" :key="endpoint.name">
                  {{ endpoint.version }} — {{ endpoint.name }}
                </li>
              </ul>
            </section>
          </div>
        </div>

      </el-container>
    </el-main>
  </el-container>

  <!-- <el-container>
    <el-aside class="search-nav" width="20%">
      <MessageDocsSearchNav />
    </el-aside>
    <el-main>
      <el-backtop :right="100" :bottom="100" target="main" />
      <div v-for="(group, key) of messageDocs" :key="key">
        <div v-for="(value, key) of group" :key="value">
          <el-divider content-position="left">{{ value.process }}</el-divider>
          <a v-bind:href="`#${value.process}`" :id="value.process">
            <h2>{{ value.description }}</h2>
          </a>
          <el-collapse v-model="activeNames" @change="handleChange">
            <el-collapse-item title="Outbound Topic" name="1">
              {{ value.outbound_topic }}
            </el-collapse-item>
            <el-collapse-item title="Inbound Topic" name="2">
              {{ value.inbound_topic }}
            </el-collapse-item>
            <el-collapse-item title="Outbound Message" name="3">
              <pre>{{ JSON.stringify(value.example_outbound_message, null, 4) }}</pre>
            </el-collapse-item>
            <el-collapse-item title="Inbound Message" name="4">
              <pre>{{ JSON.stringify(value.example_inbound_message, null, 4) }}</pre>
            </el-collapse-item>
            <el-collapse-item v-if="showRequiredFieldInfo(value.requiredFieldInfo)" title="Required Fields" name="5">
              <pre>{{ JSON.stringify(value.requiredFieldInfo, null, 4) }}</pre>
            </el-collapse-item>
            <el-collapse-item v-if="showDependentEndpoints(value.dependent_endpoints)" title="Dependent Endpoints"
              name="6">
              <ul>
                <li v-for="(endpoint, key) of value.dependent_endpoints">
                  {{ endpoint.version }}: {{ endpoint.name }}
                </li>
              </ul>
            </el-collapse-item>
          </el-collapse>
          <el-divider content-position="right">{{ value.process }}</el-divider>
          <br />
          <br />
          <br />
          <br />
        </div>
      </div>
    </el-main>
  </el-container> -->
</template>

<style scoped>
.root {
  height: 100%;
}

.main {
  height: 100%;
  overflow: scroll;
}

.search-nav {
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

main {
  margin: 25px;
  color: #39455f;
  font-family: 'Roboto';
}

span {
  font-size: 28px;
}

div {
  font-size: 14px;
}

pre {
  font-family: 'Roboto';
}

.content :deep(strong) {
  font-family: 'Roboto';
}

a {
  text-decoration: none;
  color: #39455f;
}

/* .content :deep(a) {
  text-decoration: none;
  color: #ffffff;
  font-family: 'Roboto';
  font-size: 14px;
  border-radius: 3px;
  background-color: #52b165;
  padding: 1px;
} */

.content :deep(a):hover {
  background-color: #39455f;
}
</style>
