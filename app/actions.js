// 檔案路徑: app/actions.js
'use server';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';

// --- 使用者驗證 ---
export async function registerUser(username, password) {
  try {
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username};`;
    if (rows.length > 0) {
      return { success: false, error: '此使用者名稱已被註冊' };
    }
    // 注意：在實際產品中，密碼應該要加密儲存
    await sql`INSERT INTO users (username, password) VALUES (${username}, ${password});`;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function loginUser(username, password) {
  try {
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username};`;
    if (rows.length === 0) {
      return { success: false, error: '找不到此使用者' };
    }
    const user = rows[0];
    if (user.password !== password) {
      return { success: false, error: '密碼錯誤' };
    }
    // 登入成功時，回傳包含 id, username 和 role 的使用者物件
    return { success: true, user: { id: user.id, username: user.username, role: user.role } }; 
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// --- 專案與進度 ---
// 修改後版本：查詢專案時，一併取得 page_offset
export async function getProjectsWithProgress(userId) {
  try {
    const { rows } = await sql`
      SELECT
        p.id,
        p.name,
        p.page_offset, -- 新增這一行
        (SELECT COUNT(*) FROM source_data WHERE project_id = p.id) as total_tasks,
        (
          SELECT COUNT(*)
          FROM annotations a
          WHERE a.user_id = ${userId}
          AND a.source_data_id IN (SELECT id FROM source_data WHERE project_id = p.id)
        ) as completed_tasks
      FROM projects p
      ORDER BY p.name;
    `;
    return { projects: rows };
  } catch (error) {
    return { error: error.message };
  }
}

// --- 標註任務 ---
// 修改後版本：取得任務時，自動加上頁碼偏移量
export async function getNextTaskForUser(projectId, userId) {
  try {
    // 使用 JOIN 一次性取得專案的 page_offset
    const { rows } = await sql`
      SELECT 
        sd.*,
        p.page_offset
      FROM source_data sd
      JOIN projects p ON sd.project_id = p.id
      WHERE sd.project_id = ${projectId}
      AND NOT EXISTS (
        SELECT 1 FROM annotations a WHERE a.source_data_id = sd.id AND a.user_id = ${userId}
      )
      ORDER BY sd.id
      LIMIT 1;
    `;

    if (rows.length > 0) {
        const task = rows[0];
        // 在回傳前，將資料庫頁碼與偏移量相加
        task.page_number = (task.page_number || 0) + (task.page_offset || 0);
        return { task: task };
    }
    
    return { task: null };
  } catch (error) {
    return { error: error.message };
  }
}

export async function saveAnnotation(data) {
  const {
    source_data_id, user_id, esg_type, promise_status,
    promise_string, verification_timeline, evidence_status,
    evidence_string, evidence_quality
  } = data;
  try {
    // 使用 ON CONFLICT，如果紀錄已存在則更新，不存在則新增
    await sql`
      INSERT INTO annotations (
        source_data_id, user_id, esg_type, promise_status, promise_string,
        verification_timeline, evidence_status, evidence_string, evidence_quality, status, updated_at
      ) VALUES (
        ${source_data_id}, ${user_id}, ${esg_type}, ${promise_status}, ${promise_string},
        ${verification_timeline}, ${evidence_status}, ${evidence_string}, ${evidence_quality}, 'completed', NOW()
      )
      ON CONFLICT (source_data_id, user_id) 
      DO UPDATE SET
        esg_type = EXCLUDED.esg_type,
        promise_status = EXCLUDED.promise_status,
        promise_string = EXCLUDED.promise_string,
        verification_timeline = EXCLUDED.verification_timeline,
        evidence_status = EXCLUDED.evidence_status,
        evidence_string = EXCLUDED.evidence_string,
        evidence_quality = EXCLUDED.evidence_quality,
        status = 'completed',
        updated_at = NOW();
    `;
    revalidatePath('/'); // 通知 Next.js 清除相關頁面的快取
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}