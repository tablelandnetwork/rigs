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
    <img class="pilot" src={data.pilot} alt="pilot" />
  {/if}
</div>

<style type="text/css">
  :global(body) {
    margin: 0;
  }

  .container {
    position: relative;
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
    max-height: 37%;
    max-width: 25%;
    border-top: 0.1875rem solid #101e1e;
    border-left: 0.1875rem solid #101e1e;
    border-radius: 0.1875rem 0 0 0;
  }
</style>
