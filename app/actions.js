// 檔案路徑: app/actions.js
'use server'; 

import { sql } from '@vercel/postgres';

export async function addUser(name) {
  try {
    await sql`INSERT INTO test_users (name) VALUES (${name});`;
    return { success: true, message: `成功新增使用者: ${name}` };
  } catch (error) {
    return { success: false, message: '新增失敗: ' + error.message };
  }
}

export async function getUsers() {
  try {
    const { rows } = await sql`SELECT name, created_at FROM test_users ORDER BY created_at DESC;`;
    return { success: true, users: rows };
  } catch (error) {
    return { success: false, message: '讀取失敗: ' + error.message, users: [] };
  }
}