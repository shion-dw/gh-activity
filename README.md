# gh-activity

指定された期間内における GitHub 上での特定ユーザーの活動状況を集計する Node.js CLI ツールです。

## 集計する値

指定した Organization 内におけるリポジトリごとの以下の値

1. Issue 作成数
1. Issue への Comment 数
1. Pull Request 作成数
1. Pull Request への Review 数

## 使用方法

### 1.リポジトリを clone

```sh
$ git clone https://github.o-in.dwango.co.jp/shion/gh-activity.git
$ cd gh-activity
```

### 2. 依存パッケージをインストール

```sh
$ yarn install
```

### 3. 設定ファイルを編集

`config` ディレクトリ下にある設定ファイルの値を自身の情報に合わせて編集してください。

#### `config/default.json`

- `githubApiUrl`: GitHub API の URL。
- `terms`: Issue 、 Comment 、 PR 、 Review の数を取得する期間を指定します。配列の各要素には開始日と終了日を指定します（ ISO8601 ）。

#### `config/custom-environment-variables.json`

- `org`: 集計対象とする Organization 名。環境変数 `GITHUB_ORG` に設定した値が自動で指定される。
- `userName`: 集計対象のユーザー名。環境変数 `GITHUB_USER` に設定した値が自動で指定される。
- `githubToken`: GitHub の Personal Access Token の値。環境変数 `GITHUB_TOKEN` に設定した値が自動で指定される。

### 4. コマンドを実行

```sh
$ yarn run dev
```

JavaScript にトランスパイルしてから実行する場合

```sh
$ yarn run build
$ yarn run start
```

### 5. 出力結果を確認する

1. 標準出力
1. csv ファイル出力
   - 出力先: `output/activities_yyyy-MM-dd_yyyy-MM-dd.csv`
   - `config/default.json` の `terms` で指定した要素数分だけファイルが出力されます。
