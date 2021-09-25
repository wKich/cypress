<template>
  <div v-if="query.data.value?.wizard.storybook?.configured">
    <h2>New Spec</h2>
    <ul v-if="query.data.value?.wizard?.storybook?.mainJs?.stories">
      <li v-for="story of query.data.value?.wizard.storybook.mainJs.stories" @click="storyClick(story)">{{story}}</li>
    </ul>
  </div>
  <div v-else>
    Storybook is not configured for this project
  </div>
</template>

<route>
{
  name: "New Spec Page"
}
</route>

<script lang="ts" setup>
import { gql, useMutation, useQuery } from '@urql/vue'
import { MainQueryDocument, GenerateSpecFromStoryDocument } from '../generated/graphql'

gql`
query MainQuery {
  wizard {
    storybook {
      configured
      mainJs {
        stories
      }
    }
  }
}
`

gql`
mutation GenerateSpecFromStory($storyPath: String!) {
  generateSpecFromStory (storyPath: $storyPath) {
    storybook {
      generatedSpecs {
        name,
        relative,
        absolute
      }
    }
  }
} 
`

const query = useQuery({query: MainQueryDocument})
const mutation = useMutation(GenerateSpecFromStoryDocument)

async function storyClick(story) {
  await mutation.executeMutation({storyPath: story})
  const generatedSpecs = mutation.data.value?.generateSpecFromStory.storybook?.generatedSpecs || []
  const newSpec = generatedSpecs[generatedSpecs.length - 1];
  // Runner doesn't pick up new file without timeout, I'm guessing a race condition between file watcher and runner starting
  setTimeout(() => {
    window.location.href = `${window.location.origin}/__/#/tests/component/${newSpec.relative}`
  }, 500)
}
</script>