import * as fs from 'fs';
import * as path from 'path';
import {
    readUserCredentialsFromExcelAsync,
    batchLoginFromExcel,
    batchGetUserInfo,
    AuthResult,
    wsUrl
} from './apis';
/**
 * 生成单个消息发送脚本
 */
function generateMessageScript(user: AuthResult, targetUid: string, fileIndex: number): string {
    return `// 自动生成的消息发送脚本 - 用户 ${fileIndex + 1}
import { MessageText, Channel, WKSDK, ChannelTypePerson, ConnectStatus } from "wukongimjssdk";

// 服务器配置
WKSDK.shared().config.addr = '${wsUrl}';

// 用户认证信息
const uid = '${user.uid}';
const token = '${user.token}';
const targetChannel = "${targetUid}";

WKSDK.shared().config.uid = uid;
WKSDK.shared().config.token = token;

const channelType = ChannelTypePerson
WKSDK.shared().connectManager.connect();

// 连接状态监听
WKSDK.shared().connectManager.addConnectStatusListener(
    (status: ConnectStatus, reasonCode?: number) => {
        if (status === ConnectStatus.Connected) {
            console.log('连接成功');
            sendMessages();
        } else {
            console.log('连接失败', reasonCode); //  reasonCode: 2表示认证失败（uid或token错误）
        }
    },
);

// 异步发送消息
async function sendMessages() {
    while (true) {
        const text = new MessageText(randomString(500, charset));
        await WKSDK.shared().chatManager.send(text, new Channel(targetChannel, channelType));
        await sleep(3000);
    }
}

function sleep(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
}

function randomString(length: number, chars: string): string {
    let result = '';
    for (let i = length; i > 0; --i) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
`;
}

/**
 * 直接生成所有消息发送脚本（不需要中间token文件）
 */
async function generateMessageScriptsDirect(
    excelFilePath: string,
    outputDir: string = './message_scripts',
    senderStartIndex: number = 1, // 发送者起始索引（从0开始，默认从第2个用户开始）
    senderCount: number = 10,     // 发送者数量
    targetUserIndex: number = 0   // 目标用户索引（默认第1个用户）
): Promise<string[]> {
    try {
        console.log('开始直接生成消息发送脚本...');

        // 读取Excel文件
        const allUsers = await readUserCredentialsFromExcelAsync(excelFilePath);
        console.log(`成功从Excel读取 ${allUsers.length} 个用户`);

        // 检查范围是否有效
        if (senderStartIndex + senderCount > allUsers.length) {
            throw new Error(`请求的范围超出用户数量。Excel中有 ${allUsers.length} 个用户，但请求了 ${senderStartIndex + senderCount} 个用户`);
        }

        if (targetUserIndex >= allUsers.length) {
            throw new Error(`目标用户索引 ${targetUserIndex} 超出用户数量`);
        }

        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 获取目标用户的UID
        console.log('获取目标用户信息...');
        const targetUserInfo = await batchGetUserInfo([allUsers[targetUserIndex]]);
        if (targetUserInfo.length === 0) {
            throw new Error('无法获取目标用户信息');
        }
        const targetUid = targetUserInfo[0].uid;
        console.log(`目标用户UID: ${targetUid}`);

        // 获取发送者用户
        const senderUsers = allUsers.slice(senderStartIndex, senderStartIndex + senderCount);
        console.log(`发送者用户范围: 第 ${senderStartIndex + 1} 到 ${senderStartIndex + senderCount} 个用户`);

        // 批量登录发送者用户
        console.log('登录发送者用户...');
        const loginResults = await batchLoginFromExcel(senderUsers);
        console.log(`登录成功: ${loginResults.length}/${senderUsers.length} 个用户`);

        if (loginResults.length === 0) {
            throw new Error('没有用户登录成功，无法生成脚本');
        }

        const generatedFiles: string[] = [];

        // 为每个登录成功的用户生成脚本
        for (let i = 0; i < loginResults.length; i++) {
            const user = loginResults[i];

            // 生成脚本内容
            const scriptContent = generateMessageScript(user, targetUid, i);

            // 写入文件
            const fileName = `main${i}.ts`;
            const filePath = path.join(outputDir, fileName);

            fs.writeFileSync(filePath, scriptContent, 'utf8');
            generatedFiles.push(filePath);

            console.log(`生成脚本: ${fileName} - 用户 ${senderStartIndex + i + 1} (${user.uid.slice(0, 8)}...)`);
        }

        console.log(`成功生成 ${generatedFiles.length} 个消息发送脚本到目录: ${outputDir}`);
        return generatedFiles;

    } catch (error) {
        console.error('生成消息发送脚本失败:', error);
        throw error;
    }
}

async function customGenerate() {
    try {
        await generateMessageScriptsDirect(
            './test_accounts.xlsx',
            './src',
            1,
            3,
            0
        );
    } catch (error) {
        console.error('生成失败:', error);
    }
}

customGenerate();
