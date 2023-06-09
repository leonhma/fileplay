<script lang="ts">
  import Dialog, { Title, Content } from "@smui/dialog";
  import Button, { Group, Label } from "@smui/button";
  import Textfield from "@smui/textfield";
  import LinearProgress from "@smui/linear-progress";
  import Select, { Option } from "@smui/select";

  import { get } from "svelte/store";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { getContent, withDeviceType } from "$lib/personal";

  import {
    deviceParams,
    userParams,
    profaneUsername,
    setupLoading,
  } from "$lib/stores/Dialogs";
  import Username from "$lib/components/Username.svelte";
  import { publicKey_armored } from "$lib/openpgp";
  import { NotificationPermission } from "$lib/stores/Dialogs";
  import { DeviceType } from "$lib/common";

  // let socketStore: Readable<any>;
  // let unsubscribeSocketStore = () => {};

  let open: boolean;

  let newUser = true;

  let linkingCode = "";

  let actionDisabled: boolean;
  $: {
    if (!$deviceParams.displayName || !$deviceParams.type)
      actionDisabled = true;
    else if (newUser) {
      actionDisabled =
        !$userParams.displayName ||
        get(profaneUsername).profane ||
        get(profaneUsername).loading;
    } else {
      actionDisabled = !linkingCode;
    }
  }

  let setupError: string;

  async function handleSetupKeyDown(event: CustomEvent | KeyboardEvent) {
    if (!open) return;
    event = event as KeyboardEvent;
    if (event.key === "Enter" && !actionDisabled) {
      await handleConfirm();
    }
  }

  async function handleResponseError(res: Response) {
    setupLoading.set(false);
    const json_ = (await res.json()) as any;
    if (json_) {
      setupError = json_.message;
    } else {
      setupError = res.statusText;
    }
  }

  async function handleConfirm() {
    if (actionDisabled) return;
    let keepAliveCode: string;
    setupLoading.set(true);
    // setup device if not already done so
    let storedDeviceParams = localStorage.getItem("deviceParams");
    if (
      storedDeviceParams &&
      storedDeviceParams !== JSON.stringify($deviceParams)
    ) {
      storedDeviceParams = null;
      // delete old user with still present cookie auth
      await fetch("/api/devices", {
        method: "DELETE",
      });
    }
    if (!storedDeviceParams) {
      $deviceParams.encryptionPublicKey = publicKey_armored;

      const res = await fetch("/api/setup/device", {
        method: "POST",
        body: JSON.stringify($deviceParams),
      });
      if (String(res.status).charAt(0) !== "2") {
        handleResponseError(res);
        return;
      }
      keepAliveCode = ((await res.json()) as any).keepAliveCode;
      localStorage.setItem("keepAliveCode", keepAliveCode);
      localStorage.setItem("deviceParams", JSON.stringify($deviceParams));
    }
    if (newUser) {
      // create new user
      const res = await fetch("/api/setup/user", {
        method: "POST",
        body: JSON.stringify($userParams),
      });
      if (String(res.status).charAt(0) !== "2") {
        handleResponseError(res);
        return;
      }
    } else {
      // link to existing user
      const res2 = await fetch("/api/devices/link", {
        method: "POST",
        body: JSON.stringify({ code: linkingCode }),
      });
      if (String(res2.status).charAt(0) !== "2") {
        handleResponseError(res2);
        return;
      }
    }

    localStorage.removeItem("deviceParams");
    localStorage.setItem("loggedIn", "true");
    open = false;
    setupLoading.set(false);

    getContent();
    // updatePeerJS_ID();
    // socketStore = (await import("$lib/websocket")).socketStore;
    // unsubscribeSocketStore = socketStore.subscribe(() => {});

    (await import('$lib/messages')).default_messages.init();

    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: "save_keep_alive_code",
        keepAliveCode,
      });
    });
  }

  onMount(async () => {
    if (!browser) return;
    // if device is not set up, open dialog
    if (!localStorage.getItem("loggedIn")) {
      open = true;
      // if setup was partially completed, load values
      const storedDeviceParams = localStorage.getItem("deviceParams");
      if (storedDeviceParams) {
        $deviceParams = JSON.parse(storedDeviceParams);
      }
    } else {
      getContent();
      // socketStore = (await import("$lib/websocket")).socketStore;
      // unsubscribeSocketStore = socketStore.subscribe(() => {});
    }
  });

  // onDestroy(() => {
  //   if (socketStore) unsubscribeSocketStore();
  // });
</script>

<svelte:window on:keydown={handleSetupKeyDown} />

<Dialog
  bind:open
  scrimClickAction=""
  escapeKeyAction=""
  aria-labelledby="title"
  aria-describedby="content"
>
  {#if $setupLoading}
    <LinearProgress indeterminate />
  {/if}
  <Title id="title">Setup</Title>
  <Content>
    <h6>Device</h6>
    <div id="content">
      <div id="content-device">
        <Textfield
          bind:value={$deviceParams.displayName}
          label="Device Name"
          bind:disabled={$setupLoading}
          input$maxlength={32}
        />
        <Select
          bind:value={$deviceParams.type}
          label="Device Type"
          bind:disabled={$setupLoading}
        >
          {#each Object.keys(DeviceType).map(withDeviceType) as { type, name }}
            <Option value={type}>{name}</Option>
          {/each}
        </Select>
      </div>
    </div>
    <br />
    <h6>User</h6>
    <div id="content">
      <Group variant="outlined">
        {#if newUser}
          <Button variant="unelevated" bind:disabled={$setupLoading}>
            <Label>New</Label>
          </Button>
          <Button
            bind:disabled={$setupLoading}
            on:click={() => {
              newUser = false;
              setupError = "";
            }}
            variant="outlined"
          >
            <Label>Connect to existing</Label>
          </Button>
        {:else}
          <Button
            bind:disabled={$setupLoading}
            on:click={() => {
              newUser = true;
              setupError = "";
            }}
            variant="outlined"
          >
            <Label>New</Label>
          </Button>
          <Button variant="unelevated" bind:disabled={$setupLoading}>
            <Label>Connect to existing</Label>
          </Button>
        {/if}
      </Group>
    </div>
    {#if newUser}
      <Username />
    {:else}
      <div>
        <p>
          Please generate a linking code on a device already <br />
          connected to the user by going to <br />
          <strong>Settings</strong> > <strong>Devices</strong> >
          <strong>Generate linking code</strong>.
        </p>
        <Textfield
          label="Linking Code"
          input$maxlength={6}
          bind:value={linkingCode}
          bind:disabled={$setupLoading}
          input$placeholder="6-digit code"
        />
      </div>
    {/if}
    <div class="actions">
      {#if actionDisabled}
        <Button disabled={true} on:click={handleConfirm} variant="outlined">
          <Label>Finish</Label>
        </Button>
      {:else}
        <Button disabled={false} on:click={handleConfirm} variant="raised">
          <Label>Finish</Label>
        </Button>
      {/if}

      {#if setupError}
        <p style="color:red">{setupError}</p>
      {/if}
    </div>
  </Content>
</Dialog>

<style>
  .actions {
    display: flex;
    flex-flow: row-reverse;
    justify-content: space-between;
    align-items: center;
  }
  #content {
    margin-bottom: 1.6em;
    display: flex;
    flex-flow: row;
    justify-content: center;
    gap: 10px;
  }

  #content-device {
    display: flex;
    flex-flow: row;
    gap: 7px;
  }
</style>
