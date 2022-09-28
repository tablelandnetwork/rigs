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
    width: 100%;
  }

  .badges-container {
    display: flex;
    justify-content: right;
    position: absolute;
    bottom: 0;
    left: 0;
    width: 96%;
    height: 15%;
    padding-left: 2%;
    padding-right: 2%;
  }

  .badge {
    flex: 0 1 auto;
    margin: .2rem;
    height: 80%;
  }

</style>
<div class="container">
  <img class="rig-image" src={ data.imageUrl } alt="rig" width=100%>
  <div class="badges-container">
    {#each data.badges as badge }
    <img src={ badge } class="badge" alt="badge">
    {/each}
  </div>
</div>


