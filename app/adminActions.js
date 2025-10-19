// 檔案路徑: app/adminActions.js
'use server';

import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';

// 輔助函式：檢查使用者是否為管理員
async function verifyAdmin(userId) {
    if (!userId) throw new Error('未登入或缺少使用者 ID');
    const { rows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (rows.length === 0 || rows[0].role !== 'admin') {
        throw new Error('權限不足，此操作僅限管理員');
    }
}

export async function updateProjectOffset(userId, projectId, offset) {
    try {
        await verifyAdmin(userId); // 權限檢查
        const newOffset = parseInt(offset, 10) || 0;
        await sql`UPDATE projects SET page_offset = ${newOffset} WHERE id = ${projectId};`;
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 刪除專案 (會一併刪除關聯的所有資料和標註，因為資料庫設定了 ON DELETE CASCADE)
export async function deleteProject(userId, projectId) {
    try {
        await verifyAdmin(userId); // 權限檢查
        
        console.log(`管理員 ${userId} 正在刪除專案 ${projectId}`);
        await sql`DELETE FROM projects WHERE id = ${projectId};`;
        
        revalidatePath('/admin'); // 清除快取，讓管理頁面重新整理
        return { success: true };
    } catch (error) {
        console.error('刪除專案失敗:', error);
        return { success: false, error: error.message };
    }
}

// 整合 JSON 和 PDF 的上傳功能
export async function uploadProjectFiles(userId, formData) {
    try {
        await verifyAdmin(userId); // 權限檢查

        const jsonFile = formData.get('jsonFile');
        const pdfFile = formData.get('pdfFile');
        if (!jsonFile || !pdfFile) {
            throw new Error('必須同時提供 JSON 和 PDF 檔案');
        }

        const projectName = jsonFile.name.replace('esg_annotation_', '').replace('.json', '');
        if(pdfFile.name.indexOf(projectName) === -1) {
            throw new Error('PDF 檔名與 JSON 檔名不匹配！');
        }

        // 1. 上傳 PDF 到 Vercel Blob
        const blob = await put(pdfFile.name, pdfFile, {
        access: 'public',
        allowOverwrite: true, // <-- 新增這一行
        });

        // 2. 處理 JSON 並寫入資料庫
        const client = await sql.connect();
        try {
            await client.query('BEGIN');

            let projectResult = await client.query('SELECT id FROM projects WHERE name = $1', [projectName]);
            let projectId;
            if (projectResult.rows.length === 0) {
                projectResult = await client.query('INSERT INTO projects (name) VALUES ($1) RETURNING id', [projectName]);
                projectId = projectResult.rows[0].id;
            } else {
                projectId = projectResult.rows[0].id;
            }

            const jsonText = await jsonFile.text();
            const jsonData = JSON.parse(jsonText);
            
            for (const item of jsonData) {
                const bbox = item.bbox || null;
                await client.query(
                    `INSERT INTO source_data (project_id, original_data, source_url, page_number, bbox)
                     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                    [projectId, item.data, blob.url, item.page_number, bbox]
                );
            }
            
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e; // 拋出錯誤，讓外層 catch 捕捉
        } finally {
            client.release();
        }

        revalidatePath('/admin');
        revalidatePath('/');
        return { success: true };

    } catch (error) {
        console.error('上傳專案檔案失敗:', error);
        return { success: false, error: error.message };
    }
}