import { Test, TestingModule } from "@nestjs/testing";
import { join } from "path";
import { RootController } from "./root.controller";

function mockReq(path: string) {
  return { path } as any;
}

function mockRes() {
  const res: any = { sendFile: jest.fn() };
  return res;
}

describe("RootController", () => {
  let controller: RootController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RootController],
    }).compile();
    controller = module.get<RootController>(RootController);
  });

  describe("serveAdmin()", () => {
    it("serves the resolved file path for a known asset", () => {
      const req = mockReq("/admin/assets/logo.png");
      const res = mockRes();

      controller.serveAdmin(req, res);

      const expectedPath = join(process.cwd(), "client", "dist", "/assets/logo.png");
      expect(res.sendFile).toHaveBeenCalledWith(expectedPath, expect.any(Function));
    });

    it("defaults to index.html when path is exactly /admin (empty after strip)", () => {
      const req = mockReq("/admin");
      const res = mockRes();

      controller.serveAdmin(req, res);

      const expectedPath = join(process.cwd(), "client", "dist", "/index.html");
      expect(res.sendFile).toHaveBeenCalledWith(expectedPath, expect.any(Function));
    });

    it("falls back to index.html on sendFile error (SPA client-side routes)", () => {
      const req = mockReq("/admin/some/spa/route");
      const res = mockRes();

      // First call triggers error; second call (fallback) does nothing
      res.sendFile.mockImplementationOnce((_path: string, cb: (err: Error) => void) => {
        cb(new Error("ENOENT: no such file"));
      });

      controller.serveAdmin(req, res);

      const fallbackPath = join(process.cwd(), "client", "dist", "index.html");
      expect(res.sendFile).toHaveBeenCalledTimes(2);
      expect(res.sendFile).toHaveBeenNthCalledWith(2, fallbackPath);
    });

    it("does not fall back when sendFile succeeds (no error callback invoked)", () => {
      const req = mockReq("/admin/assets/app.js");
      const res = mockRes();

      // No error: callback is never called
      res.sendFile.mockImplementation(() => {});

      controller.serveAdmin(req, res);

      expect(res.sendFile).toHaveBeenCalledTimes(1);
    });
  });
});
