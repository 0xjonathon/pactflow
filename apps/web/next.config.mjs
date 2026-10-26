import { fileURLToPath } from "node:url";
export default {
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  poweredByHeader: false,
  async rewrites() {
    const configured =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!configured) return { beforeFiles: [] };
    const target = new URL(configured);
    if (
      !["http:", "https:"].includes(target.protocol) ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    )
      throw new Error(
        "API upstream must be an HTTP(S) origin without credentials",
      );
    return {
      beforeFiles: [
        {
          source: "/api/v1/:path*",
          destination: `${target.origin}/api/v1/:path*`,
        },
      ],
    };
  },
};
