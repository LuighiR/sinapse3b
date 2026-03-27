type FrontendEnvInput =
  | NodeJS.ProcessEnv
  | Partial<Record<"SINAPSE_API_BASE_URL" | "SINAPSE_DEV_JWT" | "SINAPSE_DEV_TENANT_ID", string>>;

export type FrontendEnv = {
  apiBaseUrl: string;
  devJwt: string;
  devTenantId: string;
};

export function getFrontendEnv(input: FrontendEnvInput = process.env): FrontendEnv {
  return {
    apiBaseUrl: getRequired(input.SINAPSE_API_BASE_URL, "SINAPSE_API_BASE_URL"),
    devJwt: getRequired(input.SINAPSE_DEV_JWT, "SINAPSE_DEV_JWT"),
    devTenantId: getRequired(input.SINAPSE_DEV_TENANT_ID, "SINAPSE_DEV_TENANT_ID"),
  };
}

function getRequired(value: string | undefined, key: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(`Missing required frontend env: ${key}`);
  }

  return trimmed;
}
