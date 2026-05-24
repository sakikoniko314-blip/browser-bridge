export interface WsRequest {
  type: "request";
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface WsResponse {
  type: "response";
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export type CommandResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
