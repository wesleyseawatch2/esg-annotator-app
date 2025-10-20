// 刪除所有 blob 的腳本
// 檔案路徑: scripts/deleteAllBlobs.js

require('dotenv').config({ path: '.env.local' });
const { list, del } = require('@vercel/blob');

async function deleteAllBlobs() {
  console.log('開始刪除所有 blob...');
  
  try {
    // 列出所有 blob
    const { blobs } = await list();
    
    console.log(`找到 ${blobs.length} 個檔案`);
    
    // 批次刪除
    for (const blob of blobs) {
      console.log(`刪除: ${blob.pathname}`);
      await del(blob.url);
    }
    
    console.log('所有檔案已刪除！');
  } catch (error) {
    console.error('刪除失敗:', error);
  }
}

deleteAllBlobs();