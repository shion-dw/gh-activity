import { Octokit } from "@octokit/rest";
import config from "config";

// GitHubのPersonal Access Tokenを指定します
const githubToken = config.get<string>("githubToken");

// 対象のリポジトリとユーザーを指定します
const repo = config.get<string>("repo");
const user = config.get<string>("user");

// 開始日と終了日を指定します（YYYY-MM-DD形式）
const startDate = config.get<string>("startDate");
const endDate = config.get<string>("endDate");

// GitHubのAPI URLを指定します
const apiUrl = config.get<string>("githubApiUrl");

// GitHubのAPIを呼び出すためのOctokitクラスを生成します
const octokit = new Octokit({
  auth: githubToken,
  baseUrl: apiUrl,
});

// APIを呼び出して、指定された期間内に作成されたIssue、PR、Reviewの数を取得します
async function getUserActivity() {
  const [issues, pullRequests] = await Promise.all([
    octokit.issues.listForRepo({
      owner: repo.split("/")[0],
      repo: repo.split("/")[1],
      creator: user,
      state: "all",
      since: startDate,
      until: endDate,
    }),
    octokit.pulls.list({
      owner: repo.split("/")[0],
      repo: repo.split("/")[1],
      creator: user,
      state: "all",
      since: startDate,
      until: endDate,
    }),
  ]);
  let reviewsCount = 0;
  for (const pullRequest of pullRequests.data) {
    const { data: reviews } = await octokit.pulls.listReviews({
      owner: repo.split("/")[0],
      repo: repo.split("/")[1],
      pull_number: pullRequest.number,
      reviewer: user,
      since: startDate,
      until: endDate,
    });
    reviewsCount += reviews.length;
  }

  // 結果を集計して、標準出力に表示します
  console.log(`${user}の活動状況 (${startDate}から${endDate}まで)`);
  console.log(`- Issue数: ${issues.data.length}`);
  console.log(`- Pull Request数: ${pullRequests.data.length}`);
  console.log(`- レビュー数: ${reviewsCount}`);
}

// プログラムを実行します
getUserActivity();
