<template>
  <div>
    <page-header></page-header>

    <div class="main min-h-screen container flex flex-col items-center p-8">
      <form class="block w-full" @submit.prevent="generate">
        <div>
          <span class="text-white">count:</span>
          <input v-model="count" type="number" class="px-2 bg-white">
          <span class="pl-2 text-white">size:</span>
          <input v-model="size" type="number" class="px-2 bg-white">
          <span class="pl-2 text-white">compression:</span>
          <input v-model="compression" type="checkbox">
          <span class="pl-2 text-white">show labels:</span>
          <input v-model="labels" type="checkbox">
          <span class="pl-2 text-white">reload trait data:</span>
          <input v-model="reloadSheets" type="checkbox">
          <span class="pl-2 text-white">reload layer images:</span>
          <input v-model="reloadLayers" type="checkbox">
          <button class="ml-4 px-8 cursor-pointer font-black bg-white" @click="generate">Let's Go</button>
        </div>
      </form>

      <div class="w-full mt-16 grid gap-4 grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <div v-for="(attrs, i) in nfts" :key="i" class="">
          <img alt="" class="m-auto" :src="api + '/render?' + 'size=' + size + '&compression=' + (compression?0:-1) + '&labels=' + labels + '&reload=' + reloadLayers + '&metadata=' + encodeURIComponent(JSON.stringify(attrs))">
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
      api: process.env.api,
      count: 100,
      size: 400,
      compression: true,
      labels: true,
      reloadSheets: false,
      reloadLayers: false,
      nfts: []
    };
  },
  methods: {
    generate: async function () {
      let url = this.api + '/generate';
      const count = Math.floor(this.count);
      const hasQuery = this.reloadSheets || count;
      if (hasQuery) url += '?';

      const params = [this.reloadSheets ? 'reload=true' : '', count ? `count=${count}` : ''].filter(p => p);
      if (count) url += params.join('&');

      const res = await fetch(url);
      this.nfts = await res.json();
    }
  }
};

</script>
