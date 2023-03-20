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

// API を呼び出して、指定された期間内に作成された Issue, PR, Review の数を取得
async function getUserActivity(octokit: Octokit, repoName: string): Promise<Activity> {
  const authorIssues: Issue[] = [];
  const authorPRs: Issue[] = [];
  const allIssues: Issue[] = [];
  const allPRs: Issue[] = [];

  let page = 1;

  while (page < 100) {
    const [authorData, allData] = await Promise.all([
      octokit.rest.issues.listForRepo({
        owner: org,
        repo: repoName,
        creator: userName,
        state: "all",
        since: startDate,
        until: endDate,
        per_page: 100,
        page,
      }),
      octokit.rest.issues.listForRepo({
        owner: org,
        repo: repoName,
        state: "all",
        since: startDate,
        until: endDate,
        per_page: 100,
        page,
      }),
    ]);

    const authorIssuesNew = authorData.data.filter((datum) =>
      isIssueOrPullRequest(datum, { isIssue: true })
    );
    const authorPRsNew = authorData.data.filter((datum) =>
      isIssueOrPullRequest(datum, { isIssue: false })
    );
    const allIssuesNew = allData.data.filter((datum) =>
      isIssueOrPullRequest(datum, { isIssue: true })
    );
    const allPRsNew = allData.data.filter((datum) =>
      isIssueOrPullRequest(datum, { isIssue: false })
    );

    if (authorIssuesNew.length === 0 && authorPRsNew.length === 0 && allIssuesNew.length === 0 && allPRsNew.length === 0) {
      break;
    }

    authorIssues.push(...authorIssuesNew);
    authorPRs.push(...authorPRsNew);
    allIssues.push(...allIssuesNew);
    allPRs.push(...allPRsNew);

    page++;
  }

  const [authorComments, authorReviews] = await Promise.all([
    getAllCommentsByUser(octokit, org, repoName, userName, allIssues),
    getAllReviewsByUser(octokit, org, repoName, userName, allPRs),
  ]);

  return {
    repository: repoName,
    issuesCreated: authorIssues.length,
    issueCommentsCount: authorComments.length,
    prsCreated: authorPRs.length,
    prReviewsCount: authorReviews.length,
  };
}

// 特定の Organization における全リポジトリのユーザーの活動状況を取得する
async function getAllActivity(orgName: string): Promise<Activity[]> {
  // GitHub の API を呼び出すための Octokit クラスを生成
  const octokit = new Octokit({
    auth: githubToken,
    baseUrl: apiUrl,
  });
  const repositories = await getRepositoriesFromOrg(octokit, orgName);
  const activities = repositories.map((repo) => getUserActivity(octokit, repo));
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
}

// 特定の Organization 内のリポジトリ一覧を取得する
async function getRepositoriesFromOrg(octokit: Octokit, orgName: string) {
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
    if (repoNames.length === 0) break;
    repositories.push(...repoNames);
    page++;
  }
  return [...new Set(repositories)];
}

// ユーザーが書き込んだ Issue コメント群を取得
async function getAllCommentsByUser(
  octokit: Octokit,
  orgName: string,
  repoName: string,
  userName: string,
  issues: Issue[]
): Promise<Comment[]> {
  const promises = issues.map((issue) =>
    octokit.issues.listComments({
      owner: orgName,
      repo: repoName,
      issue_number: issue.number,
    })
  );
  const results = await Promise.all(promises);
  return results.flatMap(({ data }) =>
    data.filter((comment) => isAuthor(comment, userName))
  );
}

// ユーザーが書き込んだ PR レビュー群を取得
async function getAllReviewsByUser(
  octokit: Octokit,
  orgName: string,
  repoName: string,
  userName: string,
  prs: Issue[]
): Promise<Review[]> {
  const promises = prs.map((pullRequest) =>
    octokit.pulls.listReviews({
      owner: orgName,
      repo: repoName,
      pull_number: pullRequest.number,
    })
  );
  const results = await Promise.all(promises);
  return results.flatMap(({ data }) =>
    data.filter((review) => isAuthor(review, userName))
  );
}

function isIssueOrPullRequest(
  datum: Issue,
  option: { isIssue: boolean }
): boolean {
  return option.isIssue
    ? typeof datum.pull_request === "undefined"
    : typeof datum.pull_request !== "undefined";
}

function isAuthor(datum: Comment | Review, userName: string) {
  return datum.user?.login === userName;
}

async function main() {
  const activities = await getAllActivity(org);
  const output = activities.reduce((acc, { repository, issuesCreated, issueCommentsCount, prsCreated, prReviewsCount }) => {
    return `${acc}${repository}\n  Issues created: ${issuesCreated}\n  Issue comments: ${issueCommentsCount}\n  PRs created: ${prsCreated}\n  PR reviews: ${prReviewsCount}\n`;
  }, "");
  console.log(output);
}

main().catch((error) => console.error(error));
