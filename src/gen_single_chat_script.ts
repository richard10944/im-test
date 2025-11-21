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
 * 生成消息发送脚本
 */
function generateMessageScript(user: AuthResult, targetUid: string, fileIndex: number): string {
    const formattedIndex = (fileIndex + 1).toString().padStart(2, '0');
    return `// 自动生成的消息发送脚本 - 用户 ${formattedIndex}
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
        await sleep(5000);
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
 * 生成连接脚本（不发送消息）
 */
function generateConnectionScript(user: AuthResult, fileIndex: number): string {
    const formattedIndex = (fileIndex + 1).toString().padStart(2, '0');
    return `// 自动生成的连接脚本 - 用户 ${formattedIndex}
import { Channel, WKSDK, ChannelTypePerson, ConnectStatus } from "wukongimjssdk";

// 服务器配置
WKSDK.shared().config.addr = '${wsUrl}';

// 用户认证信息
const uid = '${user.uid}';
const token = '${user.token}';

WKSDK.shared().config.uid = uid;
WKSDK.shared().config.token = token;

WKSDK.shared().connectManager.connect();

// 连接状态监听
WKSDK.shared().connectManager.addConnectStatusListener(
    (status: ConnectStatus, reasonCode?: number) => {
        if (status === ConnectStatus.Connected) {
            console.log('连接成功 - 仅保持连接，不发送消息');
        } else {
            console.log('连接失败', reasonCode); //  reasonCode: 2表示认证失败（uid或token错误）
        }
    },
);

console.log('连接脚本启动 - 仅保持连接状态');
`;
}

async function generateMessageScriptsDirect(
    excelFilePath: string,
    outputDir: string = './message_scripts',
    senderStartIndex: number = 1, // 发送者起始索引（从0开始，默认从第2个用户开始）
    senderCount: number = 10,     // 发送者数量
    targetUserIndex: number = 0,  // 目标用户索引（默认第1个用户）
    messageSenderCount: number = 10 // 新增参数：实际发送消息的脚本个数
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

        // 确保发送消息的脚本数量不超过总发送者数量
        if (messageSenderCount > senderCount) {
            console.warn(`警告：消息发送者数量 ${messageSenderCount} 超过总发送者数量 ${senderCount}，已调整为 ${senderCount}`);
            messageSenderCount = senderCount;
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
        console.log(`配置: ${messageSenderCount} 个脚本发送消息, ${senderCount - messageSenderCount} 个脚本仅建立连接`);

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
            let scriptContent: string;
            let scriptType: string;

            // 根据索引决定生成哪种脚本
            if (i < messageSenderCount) {
                // 生成发送消息的脚本
                scriptContent = generateMessageScript(user, targetUid, i);
                scriptType = '消息发送';
            } else {
                // 生成仅建立连接的脚本
                scriptContent = generateConnectionScript(user, i);
                scriptType = '仅连接';
            }

            const fileName = `main${i.toString().padStart(2, '0')}.ts`;
            const filePath = path.join(outputDir, fileName);

            fs.writeFileSync(filePath, scriptContent, 'utf8');
            generatedFiles.push(filePath);

            console.log(`生成脚本: ${fileName} - 用户 ${(senderStartIndex + i + 1).toString().padStart(2, '0')} (${user.uid}...) - ${scriptType}`);
        }

        console.log(`成功生成 ${generatedFiles.length} 个脚本到目录: ${outputDir}`);
        console.log(`- ${Math.min(messageSenderCount, loginResults.length)} 个消息发送脚本`);
        console.log(`- ${Math.max(0, loginResults.length - messageSenderCount)} 个连接脚本`);
        return generatedFiles;

    } catch (error) {
        console.error('生成脚本失败:', error);
        throw error;
    }
}

async function customGenerate() {
    try {
        await generateMessageScriptsDirect(
            './test_accounts.xlsx',
            './cmd',
            1,   // 从第2个用户开始
            100, // 总共100个发送者
            0,   // 目标用户是第1个用户
            20   // 新增参数：只有前30个脚本发送消息，其他70个只建立连接
        );
    } catch (error) {
        console.error('生成失败:', error);
    }
}

customGenerate();