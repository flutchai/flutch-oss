export interface WidgetInitDto {
  widgetKey: string;
  fingerprint: string;
  threadId?: string;
}

export interface WidgetInitResponse {
  threadId: string;
  sessionToken: string;
}

export interface WidgetMessageDto {
  widgetKey: string;
  threadId?: string;
  sessionToken: string;
  text: string;
}
