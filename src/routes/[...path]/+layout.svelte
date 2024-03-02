<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { Capacitor } from "@capacitor/core";
  import { onMount } from "svelte";
  import { pwaInfo } from "virtual:pwa-info";

  import "beercss";

  import { notifications } from "$lib/lib/notifications";
  import { getPath, path, registration } from "$lib/lib/UI";

  import logo from "$lib/assets/Fileplay.svg";
  import Layout from "$lib/components/Layout.svelte";
  import Add from "$lib/dialogs/Add.svelte";
  import Edit from "$lib/dialogs/Edit.svelte";
  import Notifications from "$lib/dialogs/Notifications.svelte";
  import Privacy from "$lib/dialogs/Privacy.svelte";
  import QRCode from "$lib/dialogs/QRCode.svelte";
  import Request from "$lib/dialogs/PushRequest.svelte";
  import Send from "$lib/dialogs/Send.svelte";

  let loading = 0;

  const getClass = (loading: number) => {
    if (loading === 1) {
      return "disappear";
    } else if (loading === 2) {
      return "hidden";
    } else return "";
  };

  onMount(async () => {
    const open = () => {
      if (
        localStorage.getItem("subscribedToPush") === null &&
        localStorage.getItem("privacyAccepted") == "true"
      )
        ui("#dialog-request");
    };

    if (Capacitor.isNativePlatform()) {
      notifications().initNativeListeners();
      open();
    } else if (pwaInfo) {
      const { useRegisterSW } = await import("virtual:pwa-register/svelte");
      useRegisterSW({
        immediate: true,
        onRegistered(r) {
          if (r !== undefined) {
            $registration = r;
            open();
          }
        },
        onRegisterError(error: any) {
          console.log("SW registration error", error);
        },
      });
    }

    if (!localStorage.getItem("privacyAccepted")) ui("#dialog-privacy");
  });

  $: {
    if (browser) {
      if (loading === 0 && localStorage.getItem("loggedIn")) {
        loading = 1;
        setTimeout(() => {
          loading = 2;
        }, 1100);
      }
    }
  }

  $: if (browser) $path = getPath(location.pathname, $page.url.pathname);

  $: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : "";
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html webManifest}
</svelte:head>

<div id="logo" class={getClass(loading)}>
  <img id="logo-image" src={logo} alt="Fileplay" />
</div>

<div id="overlay" class={getClass(loading)} />

{#if loading !== 0}
  <!-- Dialogs -->
  <Privacy />
  <Edit />
  <Add />
  <QRCode />
  <Request />
  <Send />

  <Notifications />

  <Layout>
    <slot />
  </Layout>
{/if}

<style>
  .disappear {
    opacity: 0;
    transition: opacity 1s;
  }

  .hidden {
    display: none !important;
    opacity: 0;
    z-index: -1 !important;
  }

  #overlay {
    position: absolute;
    z-index: 10000;
    width: 100%;
    height: 100%;
    background: var(--background);
  }

  #logo {
    position: absolute;
    z-index: 10001;
    width: 100%;
    height: 50%;
    top: 0;

    display: flex;
    justify-content: center;
    align-items: center;
  }

  img#logo-image {
    width: 300px;
    height: auto;
  }
</style>