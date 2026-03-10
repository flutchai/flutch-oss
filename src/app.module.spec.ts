import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";

describe("AppModule", () => {
  it("should bootstrap with config module", async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
  });
});
