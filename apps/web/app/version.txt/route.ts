import { getVersionInfo } from "../api/v1/_lib/version-info";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const version = getVersionInfo();
  const payload = [
    `commitSha=${version.commitSha}`,
    `branch=${version.branch}`,
    `buildTime=${version.buildTime}`,
    `environment=${version.environment}`,
    `deploymentUrl=${version.deploymentUrl}`,
  ].join("\n");

  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
