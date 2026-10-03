import { fetchArtifact } from "../security/fetch-artifact";
export type GitHubPolicy = {
  repository: string;
  requiredChecks: string[];
  requiredAppId: number;
};
export async function verifyGitHubCI(policy: GitHubPolicy, commit: string) {
  if (
    !/^[a-f0-9]{40}$/i.test(commit) ||
    !/^[-\w.]+\/[-\w.]+$/.test(policy.repository)
  )
    throw Object.assign(new Error("Pinned commit required"), {
      code: "INVALID_GITHUB_EVIDENCE",
    });
  const runs: Array<{
    name: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    app: { id: number };
    html_url: string;
  }> = [];
  for (let page = 1; page <= 5; page++) {
    const artifact = await fetchArtifact(
      `https://api.github.com/repos/${policy.repository}/commits/${commit}/check-runs?per_page=100&page=${page}`,
    );
    if (artifact.status !== 200)
      throw Object.assign(new Error("GitHub checks unavailable"), {
        code: "GITHUB_UNAVAILABLE",
      });
    const data = JSON.parse(artifact.body.toString()) as {
      total_count: number;
      check_runs: typeof runs;
    };
    if (data.total_count > 500) throw new Error("CI_RESPONSE_TOO_LARGE");
    runs.push(...data.check_runs);
    if (runs.length >= data.total_count) break;
  }
  const results = policy.requiredChecks.map((name) => {
    const run = runs.find(
      (r) =>
        r.name === name &&
        r.head_sha.toLowerCase() === commit.toLowerCase() &&
        r.app?.id === policy.requiredAppId,
    );
    return {
      name,
      found: !!run,
      status: run?.status,
      conclusion: run?.conclusion,
      url: run?.html_url,
    };
  });
  if (results.some((r) => r.found && r.status !== "completed"))
    throw Object.assign(new Error("CI is still running"), {
      code: "CI_PENDING",
    });
  return {
    passed: results.every((r) => r.found && r.conclusion === "success"),
    commit,
    repository: policy.repository,
    checks: results,
  };
}
