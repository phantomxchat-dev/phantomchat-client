import React from "react";
import GlobalLobby, { GlobalLobbyProps } from "./GlobalLobby";

export type { GlobalLobbyProps };
export interface WorldChatProps extends GlobalLobbyProps {}

export default function WorldChat(props: WorldChatProps) {
  return <GlobalLobby {...props} />;
}

export { GlobalLobby };
