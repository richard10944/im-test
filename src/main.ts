// example.ts
import WebPGenerator from './webp-generator';
import * as fs from 'fs';
import { uploadFile, uploadFileToPresignedUrl, batchGetUserInfo,readUserCredentialsFromExcelAsync,batchLoginFromExcel } from './apis'
import { error } from 'console';

// async function main() {
//   try {
//     // 确保输出目录存在
//     if (!fs.existsSync('./output')) {
//       fs.mkdirSync('./output', { recursive: true });
//     }

//     console.log('方法1: 使用标准生成器');
//     // 生成单个随机 WebP 图片
//     const result = await WebPGenerator.generateRandomWebP('./output/random-image.webp', {
//       minSizeKB: 50,
//       maxSizeKB: 200,
//       width: 800,
//       height: 600,
//       quality: 80,
//     });

//     console.log('\n生成成功:');
//     console.log(`文件路径: ${result.filePath}`);
//     console.log(`文件大小: ${result.sizeKB} KB`);
//     console.log(`图片尺寸: ${result.dimensions.width}x${result.dimensions.height}`);    
//   } catch (error) {
//     console.error('生成失败:', error);
//   }
// }

async function main() {
    try {
        const excelFilePath = "./test_accounts.xlsx"
        const users = await readUserCredentialsFromExcelAsync(excelFilePath);
        console.log('读取到的用户:', users.slice(0, 1));

        const loginResults = await batchLoginFromExcel(users.slice(0, 1));
        console.log(loginResults)
        const filePath = './output/random-image.webp'; // 替换为实际文件路径
        const result=uploadFile(filePath,loginResults[0].token)
        return result;
    } catch (error) {
        console.error('操作失败:', error);
    }
}

main().catch(console.error);