import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
const baseUrl = "http://localhost:8090/v1"

const wsUrl = "ws://localhost:5200/"
const uploadUrl = "http://localhost:9000"
// 定义类型
interface UserCredentials {
    username: string;
    password: string;
}

interface ExcelUserRow {
    区号: string | number;
    手机号: string | number;
    性别: string;
    用户昵称: string;
    登录密码: string;
    用户角色: string;
}


interface UserData {
    uid: string;
    name: string;
    vercode: string;
}

interface UserSearchResponse {
    data: UserData;
    exist: number;
}

interface UserInfo {
    uid: string;
    vercode: string;
}

interface ApplyResult {
    authUid: string;
    targetUid: string;
    success: boolean;
    message: string;
}

interface UserTokenInfo {
    uid: string;
    token: string;
    username: string;
    index: number; // 在Excel中的索引位置
}

interface TokenFile {
    users: UserTokenInfo[];
    total: number;
    generatedAt: string;
}

interface UploadResponse {
    upload_url: string;
    path: string;
    fileHash: string;
}

interface ApiResponse {
    upload_url: string;
    path: string;
}


/**
 * 从Excel文件读取用户数据并返回用户名密码数组
 * @param filePath Excel文件路径
 * @returns 包含用户名和密码的数组
 */
function readUserCredentialsFromExcel(filePath: string): UserCredentials[] {
    try {
        // 读取Excel文件
        const workbook = XLSX.readFile(filePath);

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 将工作表转换为JSON对象
        const users: ExcelUserRow[] = XLSX.utils.sheet_to_json(worksheet);

        // 处理数据，用户名 = 区号 + 手机号
        const credentials: UserCredentials[] = users.map(user => {
            // 确保区号和手机号都是字符串格式
            const areaCode = String(user.区号).trim();
            const phone = String(user.手机号).trim();

            // 拼接用户名（区号+手机号）
            const username = areaCode + phone;
            const password = String(user.登录密码).trim();

            return {
                username,
                password
            };
        });

        console.log(`成功从Excel读取 ${credentials.length} 个用户`);
        return credentials;

    } catch (error) {
        console.error('读取Excel文件失败:', error);
        throw new Error(`无法读取Excel文件: ${error}`);
    }
}

/**
 * 从Excel文件读取用户数据（异步版本）
 * @param filePath Excel文件路径
 * @returns Promise包含用户名和密码的数组
 */
async function readUserCredentialsFromExcelAsync(filePath: string): Promise<UserCredentials[]> {
    return new Promise((resolve, reject) => {
        try {
            const credentials = readUserCredentialsFromExcel(filePath);
            resolve(credentials);
        } catch (error) {
            reject(error);
        }
    });
}

interface AuthResult {
    uid: string;
    token: string;
}

// 完整的批量登录方法（整合Excel读取）
async function batchLoginFromExcel(users: UserCredentials[]): Promise<AuthResult[]> {
    try {
        console.log('开始批量登录...');

        const loginPromises = users.map(async (user) => {
            try {
                const myHeaders = new Headers();
                myHeaders.append("Content-Type", "application/json");

                const raw = JSON.stringify({
                    username: user.username,
                    password: user.password,
                    flag: 1
                });

                const requestOptions: RequestInit = {
                    method: 'POST',
                    headers: myHeaders,
                    body: raw,
                    redirect: 'follow'
                };

                const response = await fetch(`${baseUrl}/user/login`, requestOptions);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                return {
                    uid: result.uid,
                    token: result.token
                };
            } catch (error) {
                console.error(`用户 ${user.username} 登录失败:`, error);
                return null;
            }
        });

        const results = await Promise.all(loginPromises);

        // 过滤掉失败的登录
        const successfulLogins = results.filter((result): result is { uid: string; token: string } => result !== null);

        console.log(`批量登录完成: ${successfulLogins.length}/${users.length} 成功`);
        return successfulLogins;

    } catch (error) {
        console.error('批量登录过程出错:', error);
        throw error;
    }
}

/**
 * 批量获取用户UID和验证码
 * @param users 用户凭证数组
 * @returns 包含uid和vercode的用户信息数组
 */
async function batchGetUserInfo(users: UserCredentials[]): Promise<UserInfo[]> {
    const results: UserInfo[] = [];

    // 使用Promise.all并发请求
    const promises = users.map(async (user) => {
        try {
            const requestOptions: RequestInit = {
                method: 'GET',
                redirect: 'follow' as RequestRedirect
            };

            // 构建请求URL，将username作为keyword参数
            const url = `${baseUrl}/user/search?keyword=${encodeURIComponent(user.username)}`;

            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result: UserSearchResponse = await response.json();

            // 只有当用户存在时才添加到结果中
            if (result.exist === 1 && result.data) {
                return {
                    uid: result.data.uid,
                    vercode: result.data.vercode
                };
            } else {
                console.warn(`用户 ${user.username} 不存在或查询失败`);
                return null;
            }
        } catch (error) {
            console.error(`获取用户 ${user.username} 信息失败:`, error);
            return null;
        }
    });

    // 等待所有请求完成
    const settledResults = await Promise.allSettled(promises);

    // 过滤出成功的结果
    settledResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value !== null) {
            results.push(result.value);
        }
    });

    return results;
}

/**
 * 批量加好友方法
 * @param authUsers 认证用户数组（发起加好友请求的用户）
 * @param targetUsers 目标用户数组（被加好友的用户）
 * @param options 可选配置项
 * @returns 加好友结果数组
 */
async function batchAddFriends(
    authUsers: AuthResult[],
    targetUsers: UserInfo[],
    options: {
        remark?: string;
        friendGroupId?: number;
        remarkName?: string;
        delayBetweenRequests?: number;
    } = {}
): Promise<ApplyResult[]> {
    const results: ApplyResult[] = [];
    const {
        remark = "你好，我是通过批量添加认识你的",
        friendGroupId = 2,
        remarkName = "好友",
        delayBetweenRequests = 100
    } = options;

    // 遍历所有认证用户
    for (const authUser of authUsers) {
        // 对每个认证用户，遍历所有目标用户（排除自己）
        const validTargets = targetUsers.filter(target => target.uid !== authUser.uid);

        for (const target of validTargets) {
            try {
                // 准备请求头
                const myHeaders = new Headers();
                myHeaders.append("token", authUser.token);
                myHeaders.append("Content-Type", "application/json");

                // 准备请求体
                const raw = JSON.stringify({
                    "to_uid": target.uid,
                    "remark": `${remark} (来自用户${authUser.uid}...)`,
                    "vercode": target.vercode,
                    "friend_group_id": friendGroupId,
                    "remark_name": `${remarkName}_${target.uid}`
                });

                const requestOptions: RequestInit = {
                    method: 'POST',
                    headers: myHeaders,
                    body: raw,
                    redirect: 'follow' as RequestRedirect
                };

                // 发送加好友请求
                const response = await fetch(`${baseUrl}/friend/apply`, requestOptions);
                const result = await response.text();

                if (response.ok) {
                    results.push({
                        authUid: authUser.uid,
                        targetUid: target.uid,
                        success: true,
                        message: `添加好友成功: ${result}`
                    });
                    console.log(`用户 ${authUser.uid} 成功添加 ${target.uid} 为好友`);
                } else {
                    results.push({
                        authUid: authUser.uid,
                        targetUid: target.uid,
                        success: false,
                        message: `添加好友失败: ${response.status} - ${result}`
                    });
                    console.error(`用户 ${authUser.uid} 添加 ${target.uid} 失败: ${response.status}`);
                }

            } catch (error) {
                results.push({
                    authUid: authUser.uid,
                    targetUid: target.uid,
                    success: false,
                    message: `请求异常: ${error instanceof Error ? error.message : String(error)}`
                });
                console.error(`用户 ${authUser.uid} 添加 ${target.uid} 时发生异常:`, error);
            }

            // 添加延迟，避免请求过于频繁
            if (delayBetweenRequests > 0) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            }
        }
    }

    return results;
}

/**
 * 发送单个好友请求的辅助函数
 */
async function sendFriendRequest(
    authUser: AuthResult,
    target: UserInfo,
    options: {
        remark: string;
        friendGroupId: number;
        remarkName: string;
    }
): Promise<ApplyResult> {
    try {
        const myHeaders = new Headers();
        myHeaders.append("token", authUser.token);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "to_uid": target.uid,
            "remark": `${options.remark} (来自用户${authUser.uid}...)`,
            "vercode": target.vercode,
            "friend_group_id": options.friendGroupId,
            "remark_name": `${options.remarkName}_${target.uid}`
        });

        const requestOptions: RequestInit = {
            method: 'POST',
            headers: myHeaders,
            body: raw,
            redirect: 'follow' as RequestRedirect
        };

        const response = await fetch(`${baseUrl}/friend/apply`, requestOptions);
        const result = await response.text();

        if (response.ok) {
            console.log(`用户 ${authUser.uid} 成功添加 ${target.uid} 为好友`);
            return {
                authUid: authUser.uid,
                targetUid: target.uid,
                success: true,
                message: `添加好友成功: ${result}`
            };
        } else {
            console.error(`用户 ${authUser.uid} 添加 ${target.uid} 失败: ${response.status}`);
            return {
                authUid: authUser.uid,
                targetUid: target.uid,
                success: false,
                message: `添加好友失败: ${response.status} - ${result}`
            };
        }
    } catch (error) {
        console.error(`用户 ${authUser.uid} 添加 ${target.uid} 时发生异常:`, error);
        return {
            authUid: authUser.uid,
            targetUid: target.uid,
            success: false,
            message: `请求异常: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
/**
 * 并发版本的批量加好友（更高效但可能对服务器压力更大）
 */
async function batchAddFriendsConcurrent(
    authUsers: AuthResult[],
    targetUsers: UserInfo[],
    options: {
        remark?: string;
        friendGroupId?: number;
        remarkName?: string;
        concurrency?: number;
    } = {}
): Promise<ApplyResult[]> {
    const {
        remark = "你好，我是通过批量添加认识你的",
        friendGroupId = 0,
        remarkName = "好友",
        concurrency = 5
    } = options;

    const allTasks: Array<{ authUser: AuthResult; target: UserInfo }> = [];

    // 生成所有任务
    for (const authUser of authUsers) {
        const validTargets = targetUsers.filter(target => target.uid !== authUser.uid);
        for (const target of validTargets) {
            allTasks.push({ authUser, target });
        }
    }

    const results: ApplyResult[] = [];
    const batches = [];

    // 分批处理
    for (let i = 0; i < allTasks.length; i += concurrency) {
        batches.push(allTasks.slice(i, i + concurrency));
    }

    for (const batch of batches) {
        const batchPromises = batch.map(({ authUser, target }) =>
            sendFriendRequest(authUser, target, { remark, friendGroupId, remarkName })
        );

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
        });

        // 批次间延迟
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
}


/**
 * 获取指定范围的用户token并写入JSON文件
 * @param excelFilePath Excel文件路径
 * @param startIndex 起始索引（从0开始）
 * @param count 用户数量
 * @param outputPath 输出JSON文件路径
 */
async function getUserTokensAndSave(
    excelFilePath: string,
    startIndex: number,
    count: number,
    outputPath?: string
): Promise<UserTokenInfo[]> {
    try {
        console.log(`开始获取第 ${startIndex + 1} 到 ${startIndex + count} 个用户的token...`);

        // 读取Excel文件
        const allUsers = await readUserCredentialsFromExcelAsync(excelFilePath);
        console.log(`成功从Excel读取 ${allUsers.length} 个用户`);

        // 检查范围是否有效
        if (startIndex + count > allUsers.length) {
            throw new Error(`请求的范围超出用户数量。Excel中有 ${allUsers.length} 个用户，但请求了 ${startIndex + count} 个用户`);
        }

        // 获取指定范围的用户
        const targetUsers = allUsers.slice(startIndex, startIndex + count);
        console.log(`目标用户范围: 第 ${startIndex + 1} 到 ${startIndex + targetUsers.length} 个用户`);

        // 批量登录获取token
        console.log('开始批量登录...');
        const loginResults = await batchLoginFromExcel(targetUsers);
        console.log(`批量登录完成: ${loginResults.length}/${targetUsers.length} 成功`);

        // 构建用户token信息
        const userTokenInfos: UserTokenInfo[] = loginResults.map((user, index) => ({
            uid: user.uid,
            token: user.token,
            username: targetUsers[index].username,
            index: startIndex + index
        }));

        // 如果没有提供输出路径，使用默认路径
        const finalOutputPath = outputPath || `./user_tokens_${startIndex + 1}_to_${startIndex + count}.json`;

        // 准备要保存的数据
        const tokenFile: TokenFile = {
            users: userTokenInfos,
            total: userTokenInfos.length,
            generatedAt: new Date().toISOString()
        };

        // 写入JSON文件
        fs.writeFileSync(finalOutputPath, JSON.stringify(tokenFile, null, 2), 'utf8');
        console.log(`用户token信息已保存到: ${finalOutputPath}`);
        console.log(`成功获取 ${userTokenInfos.length} 个用户的token`);

        return userTokenInfos;

    } catch (error) {
        console.error('获取用户token失败:', error);
        throw error;
    }
}

/**
 * 计算文件的SHA256哈希值
 */
async function calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
    });
}

/**
 * 获取文件大小
 */
async function getFileSize(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats.size);
        });
    });
}

/**
 * 获取文件上传预签名URL
 * @param filePath 文件路径
 * @returns 上传URL和路径信息
 */
async function getFileUploadUrl(filePath: string, token: string): Promise<UploadResponse> {
    try {
        // 验证文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        // 并行计算文件哈希和大小
        const [filehash, filesize] = await Promise.all([
            calculateFileHash(filePath),
            getFileSize(filePath)
        ]);

        // 获取文件后缀
        const filesuffix = path.extname(filePath).replace('.', '') || 'file';

        const requestBody = {
            endpoint_url: uploadUrl,
            filehash: filehash,
            filesize: filesize.toString(),
            filesuffix: filesuffix
        };
        console.log(requestBody)
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("token", token);

        const requestOptions: RequestInit = {
            method: 'POST',
            headers: myHeaders,
            body: JSON.stringify(requestBody),
            redirect: 'follow'
        };

        const response = await fetch(`${baseUrl}/file/upload/presigned_checksum`, requestOptions);

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }

        const result: ApiResponse = await response.json();

        return {
            upload_url: result.upload_url,
            path: result.path,
            fileHash:filehash
        };

    } catch (error) {
        console.error('获取上传URL失败:', error);
        throw error;
    }
}

/**
 * 获取文件MIME类型
 */
function getFileMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: { [key: string]: string } = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp':"image/webp",
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * 使用PUT方法上传文件到预签名URL
 */
async function uploadFileToPresignedUrl(filePath: string,fileHash:string, uploadUrl: string): Promise<void> {
    try {
        console.log(filePath)
        // 读取文件内容
        const fileBuffer = await fs.promises.readFile(filePath);
        const fileSize = (await fs.promises.stat(filePath)).size;
        const mimeType = getFileMimeType(filePath);
        console.log(mimeType)
        const uploadOptions: RequestInit = {
            method: 'PUT',
            headers: {
                'Content-Type':mimeType,
                'Content-Length': fileSize.toString(),
                'X-Amz-Content-Sha256':fileHash
            },
            body: fileBuffer,
        };

        console.log(`开始上传文件: ${filePath} (${fileSize} bytes)`);

        const response = await fetch(uploadUrl, uploadOptions);

        if (!response.ok) {
            throw new Error(`文件上传失败! 状态: ${response.status}, 原因: ${response.statusText}`);
        }

        console.log('文件上传成功!');

    } catch (error) {
        console.error('上传文件失败:', error);
        throw error;
    }
}

/**
 * 完整的文件上传流程
 * 1. 获取预签名URL
 * 2. 使用PUT方法上传文件
 */
async function uploadFile(filePath: string, token: string): Promise<UploadResponse> {
    try {
        console.log('开始文件上传流程...');

        // 步骤1: 获取预签名URL
        console.log('正在获取上传URL...');
        const uploadInfo = await getFileUploadUrl(filePath, token);
        console.log('获取上传URL成功:', uploadInfo.upload_url);
        if (uploadInfo.upload_url != "") {
            // 步骤2: 上传文件
            console.log('正在上传文件...');
            console.log(uploadInfo.upload_url)
            await uploadFileToPresignedUrl(filePath,uploadInfo.fileHash,uploadInfo.upload_url);
            console.log('文件上传流程完成!');
        }
        return uploadInfo;

    } catch (error) {
        console.error('文件上传流程失败:', error);
        throw error;
    }
}

// 导出供其他模块使用
export {
    readUserCredentialsFromExcel,
    readUserCredentialsFromExcelAsync,
    batchLoginFromExcel,
    batchGetUserInfo,
    batchAddFriends,
    sendFriendRequest,
    batchAddFriendsConcurrent,
    getUserTokensAndSave,
    UserCredentials,
    AuthResult,
    wsUrl,
    uploadFileToPresignedUrl,
    getFileUploadUrl,uploadFile,
    UploadResponse
};
