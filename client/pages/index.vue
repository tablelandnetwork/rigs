<template>
  <div>
    <page-header></page-header>

    <div class="main min-h-screen container flex flex-col items-center p-8 text-sm">
      <div class="w-full grid gap-4 grid-cols-1 md:grid-cols-2">
        <form @submit.prevent="generate">
          <div>
            <span class="dark:text-white">count:</span>
            <input v-model="count" type="number" class="px-2 py-1 text-white dark:text-black bg-black dark:bg-white">
            <span class="pl-2 dark:text-white">reload traits:</span>
            <input v-model="reloadSheets" type="checkbox">
            <button :disabled="loading" class="ml-4 px-8 py-1 border-box cursor-pointer text-white">
              Let's go!
            </button>
            <svg v-if="loading" class="spinner inline animate-spin ml-2 h-3 w-3 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </form>

        <div>
          <div class="lg:inline-block lg:float-right">
            <span class="dark:text-white">size:</span>
            <input v-model="size" type="number" class="px-2 py-1 text-white dark:text-black bg-black dark:bg-white">
            <span class="pl-2 dark:text-white">compression:</span>
            <input v-model="compression" type="checkbox">
            <span class="pl-2 dark:text-white">show labels:</span>
            <input v-model="labels" type="checkbox">
            <span class="pl-2 dark:text-white">reload layers:</span>
            <input v-model="reloadLayers" type="checkbox">
            <span class="pl-2 dark:text-white">dark:</span>
            <input v-model="darkMode" type="checkbox" @change="toggleDarkMode">
          </div>
        </div>
      </div>

      <div ref="grid" class="w-full mt-16 grid gap-4 grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <div v-for="(attrs, i) in nfts" :key="i" class="">
          <v-lazy-image
            :style="{ minHeight: imgHeight }"
            class="m-auto bg-black dark:bg-white bg-opacity-10 dark:bg-opacity-10"
            :src="api + '/render?' + 'size=' + size + '&compression=' + (compression?0:-1) + '&labels=' + labels + '&reload=' + reloadLayers + '&dark=' + darkMode + '&metadata=' + encodeURIComponent(JSON.stringify(attrs))"
            @intersect="imgIntersect"
            @load="imgLoad"
          />
        </div>
      </div>
    </div>

    <page-footer></page-footer>
  </div>
</template>

<script>
import VLazyImage from 'v-lazy-image/v2';

export default {
  components: {
    VLazyImage: VLazyImage
  },

  data: function () {
    return {
      api: process.env.api,
      count: 100,
      size: 500,
      compression: true,
      labels: true,
      reloadSheets: false,
      reloadLayers: false,
      nfts: [],
      loading: false,
      imgHeight: '0px',
      darkMode: false,
      auth: ''
    };
  },

  created: function () {
    this.auth = localStorage.auth ? localStorage.auth : '';
    this.darkMode = localStorage.theme === 'dark';
    this.toggleDarkMode();
    addEventListener('resize', this.resize);
  },

  destroyed: function () {
    removeEventListener('resize', this.resize);
  },

  methods: {
    generate: async function () {
      this.loading = true;
      this.nfts = [];

      let url = this.api + '/generate';
      const count = Math.floor(this.count);
      const hasQuery = this.reloadSheets || count;
      if (hasQuery) url += '?';

      const params = [this.reloadSheets ? 'reload=true' : '', count ? `count=${count}` : ''].filter(p => p);
      if (count) url += params.join('&');

      let config = {};
      if (!this.api.includes('localhost')) {
        if (this.auth.length === 0) this.setAuth(prompt('Enter password:'));
        const headers = new Headers();
        headers.append('Authorization', 'Basic ' + this.auth);
        config = { method: 'GET', headers: headers, credentials: 'include' };
      }
      const res = await fetch(url, config);
      if (!res.ok) {
        alert(res.status + ' ' + res.statusText);
        this.setAuth('');
      } else {
        this.nfts = await res.json();
        this.resize();
      }

      this.loading = false;
    },

    setAuth: function (pass) {
      this.auth = pass && pass.length > 0 ? btoa('minter:' + pass) : '';
      localStorage.auth = this.auth;
    },

    toggleDarkMode: function () {
      if (this.darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      }
    },

    resize: function () {
      const grid = getComputedStyle(this.$refs.grid);
      this.imgHeight = grid.getPropertyValue('grid-template-columns').split(' ')[0];
    },

    imgIntersect: function () {
      console.log('intersect detected'); // eslint-disable-line no-console
    },

    imgLoad: function () {
      console.log('image loaded'); // eslint-disable-line no-console
    }
  }
};

</script>
