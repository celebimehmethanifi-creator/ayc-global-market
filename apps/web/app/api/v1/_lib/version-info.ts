export type VersionInfo = {
  commitSha: string;
  branch: string;
  buildTime: string;
  environment: string;
  deploymentUrl: string;
};

const CLI_FALLBACK = "not_provided_by_cli_deploy";

function normalizeEnvValue(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "unknown") return null;
  return raw;
}

function toIsoMaybe(value?: string): string {
  if (!value) return CLI_FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function getVersionInfo(): VersionInfo {
  const commitSha =
    normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_SHA) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_COMMIT_SHA) ||
    normalizeEnvValue(process.env.GIT_COMMIT_SHA) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_GIT_COMMIT_SHA) ||
    CLI_FALLBACK;

  const branch =
    normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_REF) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_BRANCH) ||
    normalizeEnvValue(process.env.GIT_BRANCH) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_GIT_BRANCH) ||
    CLI_FALLBACK;

  const buildTime = toIsoMaybe(
    normalizeEnvValue(process.env.BUILD_TIME) ||
      normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_TIMESTAMP) ||
      normalizeEnvValue(process.env.NEXT_PUBLIC_BUILD_TIME) ||
      CLI_FALLBACK,
  );

  const environment =
    normalizeEnvValue(process.env.VERCEL_ENV) ||
    normalizeEnvValue(process.env.NODE_ENV) ||
    CLI_FALLBACK;

  const deploymentHost =
    normalizeEnvValue(process.env.DEPLOYMENT_URL) ||
    normalizeEnvValue(process.env.VERCEL_URL) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/^https?:\/\//, "") ||
    CLI_FALLBACK;

  const deploymentUrl =
    deploymentHost === CLI_FALLBACK
      ? CLI_FALLBACK
      : deploymentHost.startsWith("http")
        ? deploymentHost
        : `https://${deploymentHost}`;

  return { commitSha, branch, buildTime, environment, deploymentUrl };
}
