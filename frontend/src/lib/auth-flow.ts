type AuthFlowInput = {
  role?: "demo-user" | "admin";
};

export function getPostLoginDestination({ role }: AuthFlowInput) {
  if (role === "admin") {
    return "/dashboard";
  }

  return "/dashboard";
}
