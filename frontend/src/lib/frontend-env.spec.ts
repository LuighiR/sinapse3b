import { getFrontendEnv } from "@/lib/frontend-env";

describe("getFrontendEnv", () => {
  it("reads the backend base url and dev auth headers", () => {
    const env = getFrontendEnv({
      SINAPSE_API_BASE_URL: "http://localhost:3000",
      SINAPSE_DEV_JWT: "token",
      SINAPSE_DEV_TENANT_ID: "tenant-1",
    });

    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.devJwt).toBe("token");
    expect(env.devTenantId).toBe("tenant-1");
  });
});
