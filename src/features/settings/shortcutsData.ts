export interface Shortcut {
  keys: string;
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl/Cmd + K", description: "Open command palette" },
  { keys: "G then H", description: "Go to Home feed" },
  { keys: "G then N", description: "Go to Notifications" },
  { keys: "G then D", description: "Go to Direct messages" },
  { keys: "G then S", description: "Go to Search" },
  { keys: "C", description: "New post (Create)" },
  { keys: "?", description: "Show this shortcuts list" },
  { keys: "Esc", description: "Close dialogs / go back" },
];
