import { Controller, Get, Redirect, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { join } from "path";

@Controller()
export class RootController {
  @Get()
  @Redirect("/admin/", 302)
  root() {}

  /**
   * Serves /admin/* routes:
   * - tries to send the real file (assets, favicon, etc.)
   * - falls back to index.html for SPA client-side routes
   */
  @Get("admin/*")
  serveAdmin(@Req() req: Request, @Res() res: Response) {
    const relativePath = req.path.replace(/^\/admin/, "") || "/index.html";
    const filePath = join(process.cwd(), "client", "dist", relativePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.sendFile(join(process.cwd(), "client", "dist", "index.html"));
      }
    });
  }
}
