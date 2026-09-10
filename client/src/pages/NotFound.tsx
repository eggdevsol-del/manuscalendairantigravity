import { ActionLink, Panel, Screen } from "@/app-v3/design/primitives";
export default function NotFound() {
  return (
    <Screen title="Page not found">
      <Panel>
        <p>This page may have moved, or the link may be incomplete.</p>
        <ActionLink href="/">Return to your home</ActionLink>
      </Panel>
    </Screen>
  );
}
