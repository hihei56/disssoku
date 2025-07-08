require('dotenv').config();
const { Client, SpotifyRPC } = require('discord.js-selfbot-v13');
const randomstring = require('randomstring');

// 環境変数の確認
if (!process.env.TOKEN || !process.env.DISSOKU_CHANNELS) {
    console.error('エラー: .envファイルにTOKENとDISSOKU_CHANNELSを定義してください。');
    process.exit(1);
}

// クライアントの設定
const client = new Client({ syncStatus: false });

// 環境変数からチャンネルIDを取得
const channels = process.env.DISSOKU_CHANNELS.split(',').filter(id => id.trim() !== '');

// ボットの設定
const BOT_CONFIGS = [
    {
        id: '761562078095867916',
        name: 'Dissoku',
        command: 'up',
        channels,
        lastBumped: {},
        cooldownActive: {},
        retryCount: {},
        nextScheduledAttempt: {}
    },
    {
        id: '903541413298450462',
        name: 'NewBot',
        command: 'up',
        channels,
        lastBumped: {},
        cooldownActive: {},
        retryCount: {},
        nextScheduledAttempt: {}
    }
];

// Spotifyステータスを設定する関数
function setSpotifyStatus() {
    const spotify = new SpotifyRPC(client)
        .setAssetsLargeImage('spotify:ab67706c0000da84c0052dc7fb523a68affdb8f7')
        .setAssetsSmallImage('spotify:ab6761610000f178049d8aeae802c96c8208f3b7')
        .setAssetsLargeText('地方創生☆チクワクティクス')
        .setState('芽兎めう (日向美ビタースイーツ♪)')
        .setDetails('地方創生☆チクワクティクス')
        .setStartTimestamp(Date.now())
        .setEndTimestamp(Date.now() + 210_000) // 3分30秒
        .setSongId('2jt59rxHFcoZpW73XjOjLJ')
        .setAlbumId('3XXE2RELSxhwcvrGgjDHtd')
        .setArtistIds(['5Ys6fi9S8rdaw2YKYenVpe']);

    client.user.setActivity(spotify);
    console.log('Spotifyステータスを設定しました');
}

// ステータスをリピートする関数
function startStatusLoop() {
    setSpotifyStatus();
    setInterval(setSpotifyStatus, 210_000); // 3分30秒
}

// 次回のアップをスケジュール
function scheduleNextBump(channelId, botConfig) {
    if (botConfig.nextScheduledAttempt?.[channelId]) clearTimeout(botConfig.nextScheduledAttempt[channelId]);

    const randomInterval = 1_800_000 + Math.random() * 600_000; // 30-40分
    const now = Date.now();
    const nextAttemptTime = botConfig.lastBumped[channelId] > now ? botConfig.lastBumped[channelId] - now : randomInterval;

    botConfig.nextScheduledAttempt[channelId] = setTimeout(async () => {
        await bumpBot(channelId, botConfig);
        scheduleNextBump(channelId, botConfig);
    }, nextAttemptTime);
}

// アップ関数
async function bumpBot(channelId, botConfig) {
    try {
        const now = Date.now();
        if (botConfig.cooldownActive[channelId] || (botConfig.lastBumped[channelId] > 0 && now - botConfig.lastBumped[channelId] < 600_000)) {
            console.log(`${botConfig.name} ${botConfig.command} をスキップ - ${channelId} の次回実行: ${new Date(botConfig.lastBumped[channelId]).toLocaleString('ja-JP')}`);
            return false;
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error(`チャンネルが見つかりません: ${channelId}`);

        await channel.sendSlash(botConfig.id, botConfig.command);
        botConfig.retryCount[channelId] = (botConfig.retryCount[channelId] || 0) + 1;
        console.log(`${botConfig.name} /${botConfig.command} を ${channelId} - ${channel.name} (${channel.guild.name}) に送信`);

        const randomStr = randomstring.generate({ length: 8, charset: 'alphanumeric' });
        await channel.send(`/${botConfig.command}スラッシュコマンドを実行しました [${randomStr}]`);
        console.log(`[${randomStr}] を ${channelId} に送信`);
        return true;
    } catch (error) {
        console.error(`/${botConfig.command} の送信に失敗 (${channelId}): ${error.message}`);
        return false;
    }
}

// メッセージハンドリング
client.on('messageCreate', async message => {
    // ボット自身のメッセージは無視
    if (message.author.id === client.user.id) return;

    // ボットコマンド処理
    const botConfig = BOT_CONFIGS.find(config => config.id === message.author.id && config.channels.includes(message.channel.id));
    if (botConfig) {
        const channelId = message.channel.id;
        botConfig.lastResponse = botConfig.lastResponse || {};
        botConfig.lastResponse[channelId] = message.content;

        if (message.content.toLowerCase().includes('successfully')) {
            botConfig.lastBumped[channelId] = Date.now();
            botConfig.cooldownActive[channelId] = false; // 成功時にクールダウンを解除
            botConfig.retryCount[channelId] = 0;
            console.log(`${botConfig.name} ${botConfig.command} が ${channelId} で成功`);
            try {
                const channel = await client.channels.fetch(channelId);
                console.log(`サーバー: ${channel.guild.name}, チャンネル: ${channel.name}`);
            } catch (error) {
                console.error(`${channelId} のチャンネル情報取得に失敗: ${error.message}`);
            }
            scheduleNextBump(channelId, botConfig);
        } else if (/(please wait|cooldown|failed|error)/i.test(message.content)) {
            botConfig.cooldownActive[channelId] = true;
            const cooldownMatch = message.content.match(/try again in (\d+) (hours?|days?|minutes?|seconds?)/i);
            let cooldownMs = 15 * 60 * 1000; // デフォルト15分
            if (cooldownMatch) {
                const value = parseInt(cooldownMatch[1]);
                const unit = cooldownMatch[2].toLowerCase();
                cooldownMs = unit.startsWith('hour') ? value * 3_600_000 :
                            unit.startsWith('day') ? value * 86_400_000 :
                            unit.startsWith('minute') ? value * 60_000 :
                            value * 1_000;
            }
            const nextEligibleTime = Date.now() + cooldownMs + 60_000;
            botConfig.lastBumped[channelId] = nextEligibleTime;
            console.log(`${botConfig.name} クールダウン/失敗 in ${channelId}. 次回試行: ${new Date(nextEligibleTime).toLocaleString('ja-JP')}`);
            scheduleNextBump(channelId, botConfig);
        }
    }
});

// クライアント準備完了ハンドラ
client.on('ready', async () => {
    console.log(`${client.user.tag} としてログイン`);

    // ステータス設定
    client.user.setPresence({ status: 'online' });
    startStatusLoop();

    // チャンネルごとの初期化
    BOT_CONFIGS.forEach(botConfig => {
        botConfig.channels.forEach(channelId => {
            botConfig.lastBumped[channelId] = 0;
            botConfig.cooldownActive[channelId] = false;
            botConfig.retryCount[channelId] = 0;
        });
    });

    // チャンネル診断
    console.log('\nチャンネル診断:');
    for (const channelId of channels) {
        try {
            const channel = await client.channels.fetch(channelId);
            console.log(`チャンネル ${channelId} - ${channel.name} in ${channel.guild.name}`);
        } catch (error) {
            console.error(`チャンネル ${channelId} へのアクセスに失敗: ${error.message}`);
        }
    }

    // 初期化
    console.log('自動アップボットが起動しました！');
    console.log(`チャンネル: ${channels.join(', ')}`);
    BOT_CONFIGS.forEach(botConfig => {
        botConfig.channels.forEach(channelId => {
            bumpBot(channelId, botConfig).then(() => scheduleNextBump(channelId, botConfig));
        });
    });

    console.log('\n重要: このセルフボットはDiscordの利用規約に違反します。自己責任で使用してください。');
});

// エラー処理
client.on('error', error => console.error(`クライアントエラー: ${error.message}`));

// Discordにログイン
client.login(process.env.TOKEN).catch(error => {
    console.error(`ログインに失敗: ${error.message}`);
    process.exit(1);
});