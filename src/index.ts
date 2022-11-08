import { notice, getInput, setFailed, getBooleanInput } from "@actions/core";
import { context } from "@actions/github";
import { rsort, inc } from "semver";
import { getOctokit } from "./getOctokit";
import { configGit } from "./configGit";
import { fetchEverything } from "./fetchEverything";
import { getLastGitTag } from "./getLastGitTag";
import { getPackageVersion } from "./getPackageVersion";
import { getLatestRelease } from "./getLatestRelease";
import { setVersion } from "./setVersion";
import { pushBranch } from "./pushBranch";
import { createRelease } from "./createRelease";
import { updateTags } from "./updateTags";

const RELEASE_TYPES = [
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease",
] as const;

const DEFAULT_VERSION = "0.1.0";

async function run(): Promise<void> {
  await configGit();

  await fetchEverything();

  const lastGitTag = await getLastGitTag();
  notice(`Last git tag: ${lastGitTag}`);

  const packageVersion = await getPackageVersion();
  notice(`package.json version: ${packageVersion}`);

  const { owner, repo } = context.repo;
  const octokit = getOctokit();
  const latestRelease = await getLatestRelease(owner, repo, octokit);
  notice(`Latest release: ${latestRelease}`);

  const versions = [lastGitTag, packageVersion, latestRelease].flatMap(
    (version) => (version === null ? [] : [version])
  );
  const sortedVersions = rsort(versions);
  const highestVersion =
    sortedVersions.length === 0 ? DEFAULT_VERSION : sortedVersions[0];
  notice(`Highest version: ${highestVersion}`);

  const releaseType = RELEASE_TYPES.find(
    (releaseType) => getInput("release-type").toLowerCase() === releaseType
  );
  if (releaseType === undefined) {
    setFailed(`Invalid release-type input: ${getInput("release-type")}`);
    return;
  }
  const releaseVersion = inc(highestVersion, releaseType);
  if (releaseVersion === null) {
    setFailed("Failed to compute release version");
    return;
  }
  notice(`Release version: ${releaseVersion}`);

  await setVersion(releaseVersion);

  await pushBranch();

  await createRelease(owner, repo, releaseVersion, octokit);

  if (getBooleanInput("update-shorthand-release")) {
    updateTags(releaseVersion);
  }
}

run();
