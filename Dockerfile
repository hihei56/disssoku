# ベースイメージとしてNode.js 18の軽量版を使用
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# 依存モジュールのインストールに必要なpackage.jsonをコピー
COPY package.json ./

# 依存モジュールをインストール
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# ポートの公開（必要に応じて、今回は不要のためコメントアウト）
# EXPOSE 3000

# アプリケーションを起動
CMD ["node", "index.js"]