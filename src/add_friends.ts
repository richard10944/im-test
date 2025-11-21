// 将excel中前10个用户，和其余所有用户加为好友
import { batchGetUserInfo, batchLoginFromExcel, readUserCredentialsFromExcelAsync, batchAddFriendsConcurrent } from "./apis";

async function main() {
    try {
        const excelFilePath = './test_accounts.xlsx'; // Excel文件路径

        const users = await readUserCredentialsFromExcelAsync(excelFilePath);
        // console.log('读取到的用户:', users);

        const userAddFriendInfos = await batchGetUserInfo(users);
        console.log('所有用户信息:', userAddFriendInfos);

        //登录前10个用户
        const loginResults = await batchLoginFromExcel(users.slice(0, 5));
        console.log('登录结果:', loginResults);

        const results = await batchAddFriendsConcurrent(loginResults, userAddFriendInfos, {
            remark: "并发添加",
            concurrency: 10
        });
    } catch (error) {
        console.error('程序执行失败:', error);
    }
}
main().catch(console.error);
