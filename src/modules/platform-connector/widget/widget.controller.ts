import { Controller, Post, Body, Req, Res, Logger, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Request, Response } from "express";
import { WidgetConnectorService } from "./widget-connector.service";
import { WidgetInitDto, WidgetInitResponse, WidgetMessageDto } from "./widget.types";

@ApiTags("Widget")
@Controller("public/widget")
export class WidgetController {
  private readonly logger = new Logger(WidgetController.name);

  constructor(private readonly widgetConnectorService: WidgetConnectorService) {}

  @Post("init")
  @HttpCode(200)
  @ApiOperation({ summary: "Initialize a widget session and obtain a session token" })
  @ApiResponse({ status: 200, description: "Session token and thread ID" })
  @ApiResponse({ status: 400, description: "threadId mismatch" })
  async init(@Body() dto: WidgetInitDto): Promise<WidgetInitResponse> {
    return this.widgetConnectorService.init(dto);
  }

  @Post("message")
  @ApiOperation({ summary: "Send a message and stream the agent response (SSE)" })
  @ApiResponse({ status: 200, description: "Server-Sent Events stream" })
  @ApiResponse({ status: 401, description: "Invalid or expired session token" })
  async message(
    @Body() dto: WidgetMessageDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.widgetConnectorService.sendMessage(dto, req, res);
  }
}
