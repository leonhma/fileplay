<script lang="ts">
  import Dialog, { Title, Content, Actions } from "@smui/dialog";
  import Button, { Label } from "@smui/button";

  import { NotificationPermission } from "$lib/stores/Dialogs";

  function handleContactAddKeyDown(event: CustomEvent | KeyboardEvent) {
    if (!$NotificationPermission) return;
    event = event as KeyboardEvent;

    if (event.key === "Escape") {
      NotificationPermission.set(false);
      closeHandler("cancel");
    } else if (event.key === "Enter") {
      NotificationPermission.set(false);
      closeHandler("confirm");
    }
  }

  async function closeHandler(e: CustomEvent<{ action: string }> | string) {
    let action: string;

    if (typeof e === "string") {
      action = e;
    } else {
      action = e.detail.action;
    }

    switch (action) {
      case "confirm":
        console.log("requesting permission to notifications");
        console.log(await Notification.requestPermission());
    }

    console.log("initializing messages after notification permission request");
    await (await import("$lib/messages")).default_messages.init();
  }
</script>

<svelte:window on:keydown={handleContactAddKeyDown} />

<Dialog
  bind:open={$NotificationPermission}
  aria-labelledby="title"
  aria-describedby="content"
  on:SMUIDialog:closed={closeHandler}
>
  <Title id="title">Request notification permission</Title>
  <Content>
    <!-- this feature doesn't work in Bromite -->
    <div>
      Yay! Your device supports Push Notifications. With Push Notifications, you
      can be notified of new messages even when you are not on the website.
      Sending notifications requires your permission. Click "Yes" to allow
      notifications.
    </div>
  </Content>
  <Actions>
    <Button action="cancel">
      <Label>No</Label>
    </Button>
    <Button action="confirm">
      <Label>Yes</Label>
    </Button>
  </Actions>
</Dialog>
