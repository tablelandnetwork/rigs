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

      <div>
        <v-lazy-image :src="rig.gateway + rig.image" />
      </div>
      <div>
        <pre class="dark:text-white">{{ JSON.stringify(rig, null, 2) }}</pre>
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
      rig: {},
      auth: '',
      loading: false,
      darkMode: false
    };
  },

  beforeMount: function () {
    this.rig = JSON.parse(this.$route.query.rig);
  },

  created: function () {
    this.auth = localStorage.auth ? localStorage.auth : '';
    this.darkMode = localStorage.theme === 'dark';
    this.toggleDarkMode();
  },

  methods: {
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
    }
  }
};
</script>
