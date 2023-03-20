import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import config from "config";

type Issue = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number];
type Comment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number]
type Review = RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number]

type Activity = {
  repository: string;
  issuesCreated: number;
  issueCommentsCount: number;
  prsCreated: number;
  prReviewsCount: number;
};

// GitHub の Personal Access Token を指定
const githubToken = config.get<string>("githubToken");

// 対象の Organization とユーザーを指定
const org = config.get<string>("org");
const userName = config.get<string>("userName");

// 開始日と終了日を指定（ ISO8601 ）
const startDate = config.get<string>("startDate");
const endDate = config.get<string>("endDate");

// GitHub の API URL を指定
const apiUrl = config.get<string>("githubApiUrl");

// GitHub の API を呼び出すための Octokit クラスを生成
const octokit = new Octokit({
  auth: githubToken,
  baseUrl: apiUrl,
});

// 特定の Organization 内のリポジトリ一覧を取得する
async function getRepositoriesFromOrg (orgName: string) {
  const repositories: string[] = [];
  let page = 1;
  while (page < 100) {
    const response = await octokit.rest.repos.listForOrg({
      org: orgName,
      type: "all",
      per_page: 100,
      page,
    });
    const repoNames = response.data.map((repo) => repo.name);
    if(repoNames.length === 0) break;
    repositories.push(...repoNames);
    page++;
  }
  return [...new Set(repositories)];
};

// APIを呼び出して、指定された期間内に作成されたIssue、PR、Reviewの数を取得
async function getUserActivity(repoName: string): Promise<Activity> {
  const authorIssues: Issue[] = [];
  const authorPRs: Issue[] = [];
  let authorPage = 1;
  while (authorPage < 100) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner: org,
      repo: repoName,
      creator: userName,
      state: "all",
      since: startDate,
      until: endDate,
      per_page: 100,
      page: authorPage,
    });
    const issues = data.filter(datum => isIssueOrPullRequest(datum, { isIssue: true }));
    const prs = data.filter(datum => isIssueOrPullRequest(datum, { isIssue: false }));
    if (issues.length === 0 && prs.length === 0) break;
    authorIssues.push(...issues);
    authorPRs.push(...prs);
    authorPage++;
  }

  const allIssues: Issue[] = [];
  const allPRs: Issue[] = [];
  let page = 1;
  while (page < 100) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner: org,
      repo: repoName,
      state: "all",
      since: startDate,
      until: endDate,
      per_page: 100,
      page,
    });
    const issues = data.filter(datum => isIssueOrPullRequest(datum, { isIssue: true }));
    const prs = data.filter(datum => isIssueOrPullRequest(datum, {isIssue: false}));
    if (issues.length === 0 && prs.length === 0) break;
    allIssues.push(...issues);
    allPRs.push(...prs);
    page++;
  }

  let commentsCount = 0;
  for (const issue of allIssues) {
    const { data: comments } = await octokit.issues.listComments({
      owner: org,
      repo: repoName,
      issue_number: issue.number,
    });
    const userComments = comments.filter(isAuthor);
    commentsCount += userComments.length;
  }

  let reviewsCount = 0;
  for (const pullRequest of allPRs) {
    const { data: reviews } = await octokit.pulls.listReviews({
      owner: org,
      repo: repoName,
      pull_number: pullRequest.number,
    });
    const userReviews = reviews.filter(isAuthor);
    reviewsCount += userReviews.length;
  }

  return {
    repository: repoName,
    issuesCreated: authorIssues.length,
    issueCommentsCount: commentsCount,
    prsCreated: authorPRs.length,
    prReviewsCount: reviewsCount,
  };
}

// 特定の Organization における全リポジトリのユーザーの活動状況を取得する
async function getAllActivity (orgName: string): Promise<Activity[]> {
  const repositories = await getRepositoriesFromOrg(orgName);
  const activities: Promise<Activity>[] = [];
  for (const repo of repositories) {
    activities.push(getUserActivity(repo));
  }
  const results = await Promise.all(activities);
  return results.filter(
    ({ issuesCreated, issueCommentsCount, prsCreated, prReviewsCount }) => {
      return (
        issuesCreated !== 0 ||
        issueCommentsCount !== 0 ||
        prsCreated !== 0 ||
        prReviewsCount !== 0
      );
    }
  );
};

async function main() {
  const activities = await getAllActivity(org);
  const output = activities.map(
    ({repository, issuesCreated, issueCommentsCount, prsCreated, prReviewsCount}) => {
      return `${repository}\n  Issues created: ${issuesCreated}\n  Issue comments: ${issueCommentsCount}\n  PRs created: ${prsCreated}\n  PR reviews: ${prReviewsCount}\n`
    }
  );
  console.log(output.join(""));
};

main().catch((error) => console.error(error));

function isIssueOrPullRequest(
  datum: Issue,
  option: { isIssue: boolean }
): boolean {
  return option.isIssue
    ? typeof datum.pull_request === "undefined"
    : typeof datum.pull_request !== "undefined";
}

function isAuthor(datum: Comment | Review) {
  return datum.user?.login === userName;
}
