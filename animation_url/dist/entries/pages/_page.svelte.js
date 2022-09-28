import { c as create_ssr_component, d as add_attribute, f as each } from "../../chunks/index.js";
const _page_svelte_svelte_type_style_lang = "";
const css = {
  code: "body{margin:0}.container.svelte-6a2q2c{position:relative}.rig-image.svelte-6a2q2c{width:100%}.badges-container.svelte-6a2q2c{display:flex;justify-content:right;position:absolute;bottom:0;left:0;width:96%;height:15%;padding-left:2%;padding-right:2%}.badge.svelte-6a2q2c{flex:0 1 auto;margin:.2rem;height:80%}",
  map: null
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  if ($$props.data === void 0 && $$bindings.data && data !== void 0)
    $$bindings.data(data);
  $$result.css.add(css);
  return `<div class="${"container svelte-6a2q2c"}"><img class="${"rig-image svelte-6a2q2c"}"${add_attribute("src", data.imageUrl, 0)} alt="${"rig"}" width="${"100%"}">
  <div class="${"badges-container svelte-6a2q2c"}">${each(data.badges, (badge) => {
    return `<img${add_attribute("src", badge, 0)} class="${"badge svelte-6a2q2c"}" alt="${"badge"}">`;
  })}</div></div>`;
});
export {
  Page as default
};
