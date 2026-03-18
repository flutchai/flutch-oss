import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import {
  AdminKbService,
  CreateKbDto,
  UpdateKbDto,
  CreateArticleDto,
  UpdateArticleDto,
} from "./admin-kb.service";

@ApiTags("Admin Knowledge Base")
@ApiBearerAuth()
@Controller("api/admin/knowledge-bases")
@UseGuards(AdminAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AdminKbController {
  constructor(private readonly kbService: AdminKbService) {}

  // ─── Knowledge Bases ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List knowledge bases" })
  @ApiResponse({ status: 200, description: "Paginated list of knowledge bases" })
  list(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.kbService.listKbs(page, limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get knowledge base by id" })
  @ApiResponse({ status: 200, description: "Knowledge base detail" })
  @ApiResponse({ status: 404, description: "Knowledge base not found" })
  getKb(@Param("id") id: string) {
    return this.kbService.getKb(id);
  }

  @Post()
  @ApiOperation({ summary: "Create knowledge base" })
  @ApiResponse({ status: 201, description: "Knowledge base created" })
  createKb(@Body() body: CreateKbDto) {
    return this.kbService.createKb(body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update knowledge base" })
  @ApiResponse({ status: 200, description: "Updated knowledge base" })
  @ApiResponse({ status: 404, description: "Knowledge base not found" })
  updateKb(@Param("id") id: string, @Body() body: UpdateKbDto) {
    return this.kbService.updateKb(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete knowledge base" })
  @ApiResponse({ status: 204, description: "Deleted" })
  @ApiResponse({ status: 404, description: "Knowledge base not found" })
  deleteKb(@Param("id") id: string) {
    return this.kbService.deleteKb(id);
  }

  // ─── Articles ───────────────────────────────────────────────────────────────

  @Get(":kbId/articles")
  @ApiOperation({ summary: "List articles for a knowledge base" })
  @ApiResponse({ status: 200, description: "Paginated list of articles" })
  @ApiResponse({ status: 404, description: "Knowledge base not found" })
  listArticles(
    @Param("kbId") kbId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20"
  ) {
    return this.kbService.listArticles(kbId, page, limit);
  }

  @Get(":kbId/articles/:id")
  @ApiOperation({ summary: "Get article detail" })
  @ApiResponse({ status: 200, description: "Article detail" })
  @ApiResponse({ status: 404, description: "Article not found" })
  getArticle(@Param("kbId") kbId: string, @Param("id") id: string) {
    return this.kbService.getArticle(kbId, id);
  }

  @Post(":kbId/articles")
  @ApiOperation({ summary: "Create article" })
  @ApiResponse({ status: 201, description: "Article created" })
  @ApiResponse({ status: 404, description: "Knowledge base not found" })
  createArticle(@Param("kbId") kbId: string, @Body() body: CreateArticleDto) {
    return this.kbService.createArticle(kbId, body);
  }

  @Patch(":kbId/articles/:id")
  @ApiOperation({ summary: "Update or publish/unpublish article" })
  @ApiResponse({ status: 200, description: "Updated article" })
  @ApiResponse({ status: 404, description: "Article not found" })
  updateArticle(
    @Param("kbId") kbId: string,
    @Param("id") id: string,
    @Body() body: UpdateArticleDto
  ) {
    return this.kbService.updateArticle(kbId, id, body);
  }

  @Delete(":kbId/articles/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete article" })
  @ApiResponse({ status: 204, description: "Deleted" })
  @ApiResponse({ status: 404, description: "Article not found" })
  deleteArticle(@Param("kbId") kbId: string, @Param("id") id: string) {
    return this.kbService.deleteArticle(kbId, id);
  }
}
