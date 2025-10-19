// 檔案路徑: app/page.js
'use client'; 

import { useState } from 'react';
import { addUser, getUsers } from './actions'; 

export default function DbTestPage() {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('點擊按鈕來測試資料庫連線...');

  const handleAddUser = async () => {
    const userName = `使用者_${Math.floor(Math.random() * 1000)}`;
    setMessage('正在新增...');
    const result = await addUser(userName);
    setMessage(result.message);
    if (result.success) {
      handleGetUsers(); 
    }
  };

  const handleGetUsers = async () => {
    setMessage('正在讀取...');
    const result = await getUsers();
    if (result.success) {
      setUsers(result.users);
      setMessage(`成功讀取 ${result.users.length} 筆資料`);
    } else {
      setMessage(result.message);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1>Vercel Postgres 串接測試</h1>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={handleAddUser} style={{ padding: '10px 20px', fontSize: '16px' }}>
          1. 新增隨機使用者
        </button>
        <button onClick={handleGetUsers} style={{ padding: '10px 20px', fontSize: '16px' }}>
          2. 讀取所有使用者
        </button>
      </div>
      <div style={{ 
        background: '#f0f0f0', 
        padding: '15px', 
        borderRadius: '8px', 
        minHeight: '50px', 
        marginBottom: '20px',
        color: message.includes('失敗') ? 'red' : 'green',
        fontWeight: 'bold'
      }}>
        <p>狀態: {message}</p>
      </div>
      <h2>資料庫中的使用者列表：</h2>
      <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '8px' }}>
        {users.length > 0 ? (
          <ul>
            {users.map((user, index) => (
              <li key={index}>
                <strong>{user.name}</strong> 
                <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                  ({new Date(user.created_at).toLocaleString()})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>目前沒有資料</p>
        )}
      </div>
    </div>
  );
}