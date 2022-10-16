// import adapter from 'sveltejs-adapter-ipfs';
import adapter from '@sveltejs/adapter-vercel';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter()
		// adapter: adapter({
		// 	fallback: 'index.html'
		// })
	}
};

export default config;
