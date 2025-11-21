// 自动生成的消息发送脚本 - 用户 2
import { MessageText, Channel, WKSDK, ChannelTypePerson, ConnectStatus } from "wukongimjssdk";

// 服务器配置
WKSDK.shared().config.addr = 'ws://im.localhost:5200/';

// 用户认证信息
const uid = 'f4okm8079csi';
const token = 'b485ae8d973b48baa0f498d05d04bed6';
const targetChannel = "f4okm7zasoao";

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
