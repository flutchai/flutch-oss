import { IsString, IsNotEmpty, IsOptional, IsObject } from "class-validator";

export class AgentStreamDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  input: any;

  @IsString()
  @IsOptional()
  requestId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
