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
      const projectName = key;

      console.log(`\n--- 開始處理專案: ${projectName} ---`);
      
      // 尋找對應的 PDF 資料夾（例如：fubon_2881_esg_report_2024）
      const pdfFolderName = allFiles.find(name => {
        const itemPath = path.join(dataFolderPath, name);
        return fs.statSync(itemPath).isDirectory() && name.includes(key);
      });

      if (!pdfFolderName) {
        console.warn(`  > 警告：找不到與 ${key} 對應的 PDF 資料夾，將不會上傳 PDF。`);
        await uploadData(client, projectName, jsonFileName, null);
      } else {
        console.log(`  > 找到對應的 PDF 資料夾: ${pdfFolderName}`);
        
        // 上傳資料夾中所有的 PDF 檔案
        const pdfFolderPath = path.join(dataFolderPath, pdfFolderName);
        const pdfFiles = fs.readdirSync(pdfFolderPath).filter(f => f.endsWith('.pdf'));
        
        console.log(`  > 找到 ${pdfFiles.length} 個 PDF 檔案`);
        
        // 建立頁碼到 URL 的對應表
        const pageUrlMap = {};
        
        for (const pdfFile of pdfFiles) {
          // 從檔名提取頁碼 (例如: fubon_2881_esg_report_2024_page_1.pdf -> 1)
          const pageMatch = pdfFile.match(/page_(\d+)\.pdf$/);
          if (pageMatch) {
            const pageNumber = parseInt(pageMatch[1], 10);
            const pdfFilePath = path.join(pdfFolderPath, pdfFile);
            const pdfFileBuffer = fs.readFileSync(pdfFilePath);
            
            console.log(`  > 正在上傳 ${pdfFile} 到 Vercel Blob...`);
            const blob = await put(pdfFile, pdfFileBuffer, {
              access: 'public',
            });
            
            pageUrlMap[pageNumber] = blob.url;
            console.log(`  > 第 ${pageNumber} 頁上傳成功`);
          }
        }
        
        // 上傳 JSON 資料，並傳入頁碼對應表
        await uploadData(client, projectName, jsonFileName, pageUrlMap);
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
async function uploadData(client, projectName, jsonFileName, pageUrlMap) {
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
    let skippedCount = 0;
    
    for (const item of jsonData) {
        const exists = await client.query(
            `SELECT 1 FROM source_data WHERE project_id = $1 AND original_data = $2`,
            [projectId, item.data]
        );

        if (exists.rows.length === 0) {
            const bbox = item.bbox || null;
            const pageNumber = item.page_number || 1;
            
            // 根據頁碼從對應表中找到對應的 PDF URL
            const pdfUrl = pageUrlMap ? pageUrlMap[pageNumber] : null;
            
            if (!pdfUrl && pageUrlMap) {
                console.warn(`  > 警告：找不到第 ${pageNumber} 頁的 PDF 檔案`);
            }
            
            await client.query(
                `INSERT INTO source_data (project_id, original_data, source_url, page_number, bbox)
                 VALUES ($1, $2, $3, $4, $5)`,
                [projectId, item.data, pdfUrl, pageNumber, bbox]
            );
            insertedCount++;
        } else {
            skippedCount++;
        }
    }
    
    console.log(`  > 資料庫處理完成: 總共 ${jsonData.length} 筆資料，新增了 ${insertedCount} 筆，跳過 ${skippedCount} 筆。`);
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  > 處理專案 ${projectName} 的資料庫操作失敗:`, error.message);
  }
}

// --- 執行主函式 ---
main();