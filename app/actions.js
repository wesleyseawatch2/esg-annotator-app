// 檔案路徑: app/actions.js
'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';

// 取得下一筆待辦的標註任務
export async function getNextTask(annotatorName) {
  try {
    // 優先找分配給自己但未完成的，其次找還未分配的
    const { rows } = await sql`
        (SELECT * FROM annotations WHERE annotator_name = ${annotatorName} AND status = 'pending' ORDER BY id LIMIT 1)
        UNION ALL
        (SELECT * FROM annotations WHERE status = 'pending' AND annotator_name IS NULL ORDER BY id LIMIT 1)
        LIMIT 1;
    `;
    if (rows.length > 0) {
      // 標記這筆資料正在被您處理
      await sql`UPDATE annotations SET annotator_name = ${annotatorName}, status = 'pending' WHERE id = ${rows[0].id};`;
      return { task: rows[0] };
    }
    return { task: null }; // 沒有更多任務了
  } catch (error) {
    return { error: error.message };
  }
}

// 儲存標註結果
export async function saveTask(taskData) {
  const {
    id, esg_type, promise_status, promise_string,
    verification_timeline, evidence_status, evidence_string,
    evidence_quality, annotator_name
  } = taskData;

  try {
    await sql`
      UPDATE annotations
      SET 
        esg_type = ${esg_type},
        promise_status = ${promise_status},
        promise_string = ${promise_string},
        verification_timeline = ${verification_timeline},
        evidence_status = ${evidence_status},
        evidence_string = ${evidence_string},
        evidence_quality = ${evidence_quality},
        annotator_name = ${annotator_name},
        status = 'completed', -- 標記為已完成
        updated_at = NOW()
      WHERE id = ${id};
    `;
    revalidatePath('/'); // 清除快取，確保下次拿到新資料
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 取得進度
export async function getProgress() {
    try {
        const total = await sql`SELECT COUNT(*) FROM annotations;`;
        const completed = await sql`SELECT COUNT(*) FROM annotations WHERE status = 'completed';`;
        return { total: total.rows[0].count, completed: completed.rows[0].count };
    } catch (error) {
        return { error: error.message };
    }
}