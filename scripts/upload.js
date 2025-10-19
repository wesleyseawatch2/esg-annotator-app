// 檔案路徑: scripts/upload.js

require('dotenv').config({ path: '.env.local' });
const { db } = require('@vercel/postgres');
const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

// --- 主要執行函式 ---
async function main() {
  const dataFolderPath = path.resolve(__dirname, '../data');

  if (!fs.existsSync(dataFolderPath)) {
    console.error(`錯誤：找不到 'data' 資料夾。`);
    return;
  }

  const allFiles = fs.readdirSync(dataFolderPath);
  const jsonFiles = allFiles.filter(file => file.startsWith('esg_annotation_') && file.endsWith('.json'));
  const pdfFiles = allFiles.filter(file => file.endsWith('.pdf'));

  if (jsonFiles.length === 0) {
    console.log("在 'data' 資料夾中沒有找到任何 'esg_annotation_*.json' 檔案。");
    return;
  }
  
  console.log(`找到 ${jsonFiles.length} 個 JSON 檔案，準備開始處理...`);

  const client = await db.connect();
  try {
    for (const jsonFileName of jsonFiles) {
      // 從 esg_annotation_fubon_2881.json 提取 fubon_2881
      const key = jsonFileName.replace('esg_annotation_', '').replace('.json', '');
      const projectName = key; // 直接用 key 當專案名稱

      console.log(`\n--- 開始處理專案: ${projectName} ---`);
      
      // 尋找對應的 PDF 檔案
      const pdfFileName = pdfFiles.find(name => name.includes(key));

      if (!pdfFileName) {
        console.warn(`  > 警告：找不到與 ${key} 對應的 PDF 檔案，將不會上傳 PDF。`);
        await uploadData(client, projectName, jsonFileName, null);
      } else {
        console.log(`  > 找到對應的 PDF: ${pdfFileName}`);
        
        // 1. 上傳 PDF 到 Vercel Blob
        const pdfFilePath = path.join(dataFolderPath, pdfFileName);
        const pdfFileBuffer = fs.readFileSync(pdfFilePath);
        
        console.log(`  > 正在上傳 ${pdfFileName} 到 Vercel Blob...`);
        const blob = await put(pdfFileName, pdfFileBuffer, {
          access: 'public',
        });
        console.log(`  > PDF 上傳成功！URL: ${blob.url}`);

        // 2. 上傳 JSON 資料，並傳入 PDF 的 URL
        await uploadData(client, projectName, jsonFileName, blob.url);
      }
    }
    console.log('\n所有檔案處理完畢！');
  } catch (error) {
    console.error('處理過程中發生嚴重錯誤:', error);
  } finally {
    client.release();
    console.log('資料庫連線已關閉。');
  }
}

// --- 上傳單一 JSON 檔案的資料到資料庫 ---
async function uploadData(client, projectName, jsonFileName, pdfUrl) {
  const jsonFilePath = path.join(__dirname, '../data', jsonFileName);
  try {
    await client.query('BEGIN');

    let projectResult = await client.query('SELECT id FROM projects WHERE name = $1', [projectName]);
    let projectId;
    if (projectResult.rows.length === 0) {
      projectResult = await client.query('INSERT INTO projects (name) VALUES ($1) RETURNING id', [projectName]);
      projectId = projectResult.rows[0].id;
      console.log(`  > 已建立新專案: ${projectName} (ID: ${projectId})`);
    } else {
      projectId = projectResult.rows[0].id;
      console.log(`  > 找到已存在的專案: ${projectName} (ID: ${projectId})`);
    }

    const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    
    let insertedCount = 0;
    for (const item of jsonData) {
        const exists = await client.query(
            `SELECT 1 FROM source_data WHERE project_id = $1 AND original_data = $2`,
            [projectId, item.data]
        );

        if (exists.rows.length === 0) {
            const bbox = item.bbox || null;
            // 插入資料時，直接寫入 pdfUrl
            await client.query(
                `INSERT INTO source_data (project_id, original_data, source_url, page_number, bbox)
                 VALUES ($1, $2, $3, $4, $5)`,
                [projectId, item.data, pdfUrl, item.page_number, bbox]
            );
            insertedCount++;
        }
    }
    
    console.log(`  > 資料庫處理完成: 總共 ${jsonData.length} 筆資料，新增了 ${insertedCount} 筆。`);
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  > 處理專案 ${projectName} 的資料庫操作失敗:`, error.message);
  }
}

// --- 執行主函式 ---
main();