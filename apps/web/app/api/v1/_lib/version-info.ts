export type VersionInfo = {
  commitSha: string;
  branch: string;
  buildTime: string;
  environment: string;
  deploymentUrl: string;
};

function toIsoMaybe(value?: string): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function getVersionInfo(): VersionInfo {
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    "unknown";

  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.GIT_BRANCH ||
    process.env.NEXT_PUBLIC_GIT_BRANCH ||
    "unknown";

  const buildTime = toIsoMaybe(
    process.env.BUILD_TIME ||
      process.env.VERCEL_GIT_COMMIT_TIMESTAMP ||
      process.env.NEXT_PUBLIC_BUILD_TIME,
  );

  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";

  const deploymentHost =
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ||
    "unknown";

  const deploymentUrl =
    deploymentHost === "unknown"
      ? "unknown"
      : deploymentHost.startsWith("http")
        ? deploymentHost
        : `https://${deploymentHost}`;

  return { commitSha, branch, buildTime, environment, deploymentUrl };
}
