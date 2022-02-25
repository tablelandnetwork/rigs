<template>
  <div>
    <page-header></page-header>

    <div class="min-h-screen container mx-auto flex flex-col items-center py-16">
      <form class="block w-full" @submit.prevent="generate">
        <div>
          <span class="pr-4">count:</span>
          <input v-model="count" type="number" class="p-2 shadow-inner bg-gray-100">
          <span class="pl-4">reload:</span>
          <input v-model="reload" type="checkbox">
          <input type="submit" value="generate" class="ml-4 p-2 border rounded shadow cursor-pointer bg-gray-100 hover:bg-gray-300">
        </div>
      </form>

      <div class="w-full mt-8 grid gap-4 grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        <div v-for="(attrs, i) in nfts" :key="i" class="rounded shadow">
          <img :src="'https://mint-staging.tableland.xyz/image?attrs=' + encodeURIComponent(JSON.stringify(attrs))">
        </div>
      </div>
    </div>

    <page-footer></page-footer>
  </div>
</template>

<script>

export default {
  data: function () {
    return {
      count: 6,
      reload: false,
      nfts: []
    };
  },
  methods: {
    generate: async function () {
      let url = 'https://mint-staging.tableland.xyz/generate';
      const count = Math.floor(this.count);
      const hasQuery = this.reload || count;
      if (hasQuery) url += '?';

      const params = [this.reload ? 'reload=true' : '', count ? `count=${count}` : ''].filter(p => p);
      if (count) url += params.join('&');

      const res = await fetch(url);
      const json = await res.json();

      this.nfts = json;
    }
  }
};

</script>
