<template>
  <Layout>
    <Wizard v-if="!loading" :gql="result" />
  </Layout>
</template>

<script lang="ts">
import { provideApolloClient, useQuery } from '@vue/apollo-composable'
import { apolloClient } from './graphql/apolloClient'
import { defineComponent, watch } from "vue";
import Layout from "./components/Layout.vue";
import Wizard from "./components/Wizard.vue";
import { gql } from '@apollo/client';
import { AppDocument } from './generated/graphql'

gql`
query App {
  ...Wizard
}
`

export default defineComponent({
  name: "App",
  components: {
    Layout,
    Wizard,
  },
  setup() {
    provideApolloClient(apolloClient)
    const { onResult, loading, result } = useQuery(AppDocument)

    onResult((result) => {
      console.log(result)
    })

    watch(result, value => {
      console.log(value)
    })
    
    return {
      loading,
      result
    }
  }
});
</script>
