<script>
  /** @type {import('./$types').PageData} */
  export let data;
</script>

<div class="container">
  <img class="rig-image" src={data.imageUrl} alt="rig" width="100%" />
  <div class="badges-container">
    {#each data.badges as badge}
      {#if badge}
        <img src={badge} class="badge" alt="badge" />
      {:else}
        <div class="badge" />
      {/if}
    {/each}
  </div>
  {#if data.pilot}
    <div class="pilot">
      <img src={data.pilot.uri} alt="pilot" />
    </div>
    <span class="warning">Status: In-flight (not transferable).</span>
  {/if}
</div>

<style type="text/css">
  :global(body) {
    margin: 0;
  }

  /**
  * @license
  * MyFonts Webfont Build ID 3867246, 2020-12-16T11:57:38-0500
  * 
  * The fonts listed in this notice are subject to the End User License
  * Agreement(s) entered into by the website owner. All other parties are 
  * explicitly restricted from using the Licensed Webfonts(s).
  * 
  * You may obtain a valid license at the URLs below.
  * 
  * Webfont: AndaleMonoPaneuropeanRegular by Monotype
  * URL: https://www.myfonts.com/products/regular-andale-mono-paneuropean-345935
  * Copyright: Copyright © 2014 Monotype Imaging Inc. All rights reserved.
  * 
  * © 2020 MyFonts Incn*/
  @font-face {
    font-family: "AndaleMono";
    src: url("@/assets/fonts/andale-mono.woff2") format("woff2"),
      url("@/assets/fonts/andale-mono.woff") format("woff");
  }

  .container {
    position: relative;
    width: 100vh;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vw;
    margin: 0 auto;
  }

  .rig-image {
    display: block;
    width: 100%;
  }

  .badges-container {
    display: flex;
    flex-flow: column;
    justify-content: left;
    position: absolute;
    top: 0;
    left: 0;
    height: 99%;
    width: 10%;
    padding-left: 0.7%;
    padding-top: 0.7%;
  }

  .badge {
    flex-direction: column;
    margin: 5%;
    width: 80%;
  }

  .pilot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 25%;
    height: 25%;
    border-top: 0.1875rem solid #101e1e;
    border-left: 0.1875rem solid #101e1e;
    border-radius: 0.1875rem 0 0 0;
    background-color: #101e1e;
  }

  .pilot img, .pilot video {
    object-fit: contain;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .warning {
    position: absolute;
    top: 2rem;
    left: 0;
    font-family: "AndaleMono", sans-serif;
    font-size: 0.7rem;
    padding: 0.375rem 0.5625rem 0.46875rem;
    color: #75b6b5;
    background-color: #101e1e;
    border-radius: 0 0.1875rem 0.1875rem 0;
  }
</style>
