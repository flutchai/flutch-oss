import { Controller, Post, Body, Req, Res, Logger, HttpCode } from "@nestjs/common";
import { Request, Response } from "express";
import { WidgetConnectorService } from "./widget-connector.service";
import { WidgetInitDto, WidgetInitResponse, WidgetMessageDto } from "./widget.types";

@Controller("public/widget")
export class WidgetController {
  private readonly logger = new Logger(WidgetController.name);

  constructor(private readonly widgetConnectorService: WidgetConnectorService) {}

  @Post("init")
  @HttpCode(200)
  async init(@Body() dto: WidgetInitDto): Promise<WidgetInitResponse> {
    return this.widgetConnectorService.init(dto);
  }

  @Post("message")
  async message(
    @Body() dto: WidgetMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.widgetConnectorService.sendMessage(dto, req, res);
  }
}
