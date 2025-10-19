'use client';

import { useState, useEffect, useRef } from 'react';
import { getProjectsWithProgress } from '../actions';
import { deleteProject, uploadProjectFiles, updateProjectOffset } from '../adminActions';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const formRef = useRef(null);
    const router = useRouter();

    // 權限檢查與載入專案
    useEffect(() => {
        const savedUser = localStorage.getItem('annotatorUser');
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            // 檢查是否為管理員
            if (parsedUser.role !== 'admin') {
                alert('權限不足，將返回主頁面');
                router.push('/');
            } else {
                setUser(parsedUser);
                loadProjects(parsedUser.id);
            }
        } else {
             alert('請先登入');
             router.push('/');
        }
    }, [router]);

    // 載入專案列表和進度
    const loadProjects = async (userId) => {
        // getProjectsWithProgress 會回傳 page_offset
        const data = await getProjectsWithProgress(userId); 
        if(data.projects) setProjects(data.projects);
    };

    // 處理專案刪除
    const handleDelete = async (projectId) => {
        if (window.confirm('確定要刪除這個專案嗎？這將永久移除所有相關資料！')) {
            const result = await deleteProject(user.id, projectId);
            if (result.success) {
                alert('刪除成功');
                loadProjects(user.id);
            } else {
                alert(`刪除失敗: ${result.error}`);
            }
        }
    };

    // 處理檔案上傳
    const handleUpload = async (event) => {
        event.preventDefault();
        if (!user) return;

        const formData = new FormData(formRef.current);
        
        setIsUploading(true);
        setMessage('正在上傳檔案與處理資料，請稍候...');

        const result = await uploadProjectFiles(user.id, formData);
        
        setIsUploading(false);
        if (result.success) {
            setMessage('專案檔案上傳與資料匯入成功！');
            formRef.current.reset();
            loadProjects(user.id);
        } else {
            setMessage(`上傳失敗: ${result.error}`);
        }
    };

    // 處理頁碼偏移量變更（失去焦點時觸發）
    const handleOffsetChange = async (projectId, newOffset) => {
        if (!user) return;
        
        // 確保 newOffset 是有效的數字
        const parsedOffset = parseInt(newOffset, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
            alert('偏移量必須是零或正整數！');
            loadProjects(user.id); // 重新載入以恢復舊值
            return;
        }

        const result = await updateProjectOffset(user.id, projectId, parsedOffset);
        if (!result.success) {
            alert(`更新失敗: ${result.error}`);
        } else {
            // 為了讓畫面立即反應，手動更新 state
            setProjects(prevProjects => prevProjects.map(p => 
                p.id === projectId ? { ...p, page_offset: parsedOffset } : p
            ));
            // 不需要特別顯示成功訊息，因為 onBlur 會一直觸發
        }
    };

    if (!user) return <div className="container"><h1>驗證權限中...</h1></div>;

    return (
        <div className="container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h1>管理員後台</h1>
                <button className="btn" onClick={() => router.push('/')}>返回標註頁面</button>
            </div>

            {/* 上傳新專案區塊 */}
            <div className="panel">
                <h2>上傳新專案</h2>
                <p className="hint">請同時選擇 JSON 資料檔和對應的 PDF 報告檔。系統會根據檔名自動建立或更新專案。</p>
                <form ref={formRef} onSubmit={handleUpload} style={{ marginTop: '15px' }}>
                    <div className="field">
                        <label>JSON 資料檔 (esg_annotation_*.json)</label>
                        <input name="jsonFile" type="file" accept=".json" required disabled={isUploading} />
                    </div>
                    <div className="field">
                        <label>PDF 報告檔</label>
                        <input name="pdfFile" type="file" accept=".pdf" required disabled={isUploading} />
                    </div>
                    <button type="submit" className="btn btn-success" disabled={isUploading}>
                        {isUploading ? '上傳中...' : '上傳專案'}
                    </button>
                    {message && <p className="hint" style={{color: message.includes('失敗') ? 'red' : 'green', marginTop: '10px'}}>{message}</p>}
                </form>
            </div>
            
            {/* 專案列表區塊 */}
            <div className="panel" style={{marginTop: '20px'}}>
                <h2>專案列表</h2>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr style={{borderBottom: '1px solid #ddd'}}>
                            <th style={{textAlign: 'left', padding: '8px'}}>專案名稱</th>
                            <th style={{textAlign: 'left', padding: '8px'}}>總任務數</th>
                            <th style={{textAlign: 'center', padding: '8px'}}>要跳過幾頁</th>
                            <th style={{textAlign: 'left', padding: '8px'}}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map(p => (
                            <tr key={p.id} style={{borderBottom: '1px solid #eee'}}>
                                <td style={{padding: '8px'}}>{p.name}</td>
                                <td style={{padding: '8px'}}>{p.total_tasks}</td>
                                {/* 頁碼偏移量輸入框 */}
                                <td style={{padding: '8px', textAlign: 'center'}}>
                                    <input 
                                        type="number"
                                        // 確保我們使用從後端接收到的 page_offset
                                        defaultValue={p.page_offset || 0}
                                        onBlur={(e) => handleOffsetChange(p.id, e.target.value)}
                                        style={{width: '60px', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px'}}
                                        min="0"
                                    />
                                </td>
                                <td style={{padding: '8px'}}>
                                    <button className="btn highlight-btn-clear" onClick={() => handleDelete(p.id)}>刪除</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {projects.length === 0 && <p style={{padding: '15px', textAlign: 'center'}}>沒有可管理的專案。</p>}
            </div>
        </div>
    );
}
