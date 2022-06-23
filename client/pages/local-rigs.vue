<template>
  <div>
    <page-header></page-header>

    <div
      class="main min-h-screen container flex flex-col items-center p-8 text-sm"
    >
      <div class="w-full grid gap-4 grid-cols-1 md:grid-cols-2">
        <form @submit.prevent="generate">
          <div>
            <svg
              v-if="loading"
              class="spinner inline animate-spin ml-2 h-3 w-3 dark:text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </form>

        <div>
          <div class="lg:inline-block lg:float-right">
            <span class="pl-2 dark:text-white">dark:</span>
            <input
              v-model="darkMode"
              type="checkbox"
              @change="toggleDarkMode"
            />
          </div>
        </div>
      </div>

      <div
        ref="grid"
        class="
          w-full
          mt-16
          grid
          gap-4
          grid-cols-3
          md:grid-cols-4
          lg:grid-cols-5
        "
      >
        <div v-for="(rig, i) in rigs" :key="i" class="" @click="openRig(rig)">
          <p class="dark:text-white">{{ rig.id }}.</p>
          <v-lazy-image
            :style="{ minHeight: imageHeight }"
            class="
              m-auto
              bg-black
              dark:bg-white
              bg-opacity-20
              dark:bg-opacity-20
            "
            :class="{ original: rig.original }"
            :src="rig.gateway + rig.thumb"
            @intersect="imageIntersect"
            @load="imageLoad"
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
      rigs: [],
      imageHeight: '0px',
      auth: '',
      loading: false,
      darkMode: false
    };
  },

  beforeMount: function () {
    this.getRigs();
  },

  created: function () {
    this.auth = localStorage.auth ? localStorage.auth : '';
    this.darkMode = localStorage.theme === 'dark';
    this.toggleDarkMode();
    addEventListener('resize', this.resizeImages);
  },

  destroyed: function () {
    removeEventListener('resize', this.resizeImages);
  },

  methods: {
    getRigs: async function () {
      if (this.rigs.length > 0) return;

      this.loading = true;
      this.rigs = [];
      const url = this.api + '/rigs';
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
        this.rigs = await res.json();
        this.resizeImages();
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

    resizeImages: function () {
      const grid = getComputedStyle(this.$refs.grid);
      this.imageHeight = grid
        .getPropertyValue('grid-template-columns')
        .split(' ')[0];
    },

    imageIntersect: function () {
      console.log('intersect detected'); // eslint-disable-line no-console
    },

    imageLoad: function () {
      console.log('image loaded'); // eslint-disable-line no-console
    },

    openRig: function (rig) {
      const routeData = this.$router.resolve({
        name: 'local-rig',
        query: { rig: JSON.stringify(rig) }
      });
      window.open(routeData.href, '_blank');
    }
  }
};
</script>
