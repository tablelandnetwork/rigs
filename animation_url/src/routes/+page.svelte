<script>
  /** @type {import('./$types').PageData} */
  export let data;

</script>

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
    justify-content: left;
    position: absolute;
    top: 0;
    left: 0;
    width: 96%;
    height: 9.6%;
    padding-top: 2%;
    padding-left: 2%;
    padding-right: 2%;
  }

  .badge {
    flex: 0 1 auto;
    margin: .2rem;
    height: 80%;
  }

  .pilot {
    position: absolute;
    bottom: 0;
    right: 0;
    height: 20%;
    border-top: 0.1875rem solid #101e1e;
    border-left: 0.1875rem solid #101e1e;
    border-radius: 0.1875rem 0 0 0;
  }

</style>
<div class="container">
  <img class="rig-image" src={ data.imageUrl } alt="rig" width=100%>
  <div class="badges-container">
    {#each data.badges as badge }
    <img src={ badge } class="badge" alt="badge">
    {/each}
  </div>
  {#if data.pilot}
  <img class="pilot" src={ data.pilot } alt="pilot">
  {/if}
</div>


