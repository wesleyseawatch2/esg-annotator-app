// 檔案路徑: app/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link'; // 匯入 Link 元件
import { 
  registerUser, 
  loginUser, 
  getProjectsWithProgress, 
  getNextTaskForUser, 
  saveAnnotation 
} from './actions';
import dynamic from 'next/dynamic';

// 使用 next/dynamic 進行動態載入，並關閉 SSR
// 這可以解決 'DOMMatrix is not defined' 的錯誤
const PDFViewer = dynamic(() => import('../components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="pdf-status">正在載入 PDF 瀏覽器...</div>
});


// --- 子元件 ---

// 1. 登入/註冊畫面元件
function LoginRegisterScreen({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!username || !password) {
      setMessage('使用者名稱和密碼不能為空');
      return;
    }
    setMessage('處理中...');
    let result;
    if (isLogin) {
      result = await loginUser(username, password);
      if (result.success) {
        onLoginSuccess(result.user);
      } else {
        setMessage(`登入失敗: ${result.error}`);
      }
    } else {
      result = await registerUser(username, password);
      if (result.success) {
        setMessage('註冊成功！請切換到登入頁面進行登入。');
        setIsLogin(true);
      } else {
        setMessage(`註冊失敗: ${result.error}`);
      }
    }
  };

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <h2>{isLogin ? '登入' : '註冊'}</h2>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="使用者名稱" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="密碼" />
        <button onClick={handleSubmit}>{isLogin ? '登入' : '註冊'}</button>
        <p style={{ color: message.includes('失敗') ? 'red' : 'green', marginTop: '10px', height: '20px' }}>{message}</p>
        <button onClick={() => {setIsLogin(!isLogin); setMessage('');}} style={{ background: 'grey', marginTop: '10px' }}>
          切換到 {isLogin ? '註冊' : '登入'}
        </button>
      </div>
    </div>
  );
}

// 2. 選擇專案畫面元件 (含管理後台連結)
function ProjectSelectionScreen({ user, onProjectSelect, onLogout }) {
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    async function fetchProjects() {
      const { projects, error } = await getProjectsWithProgress(user.id);
      if (error) alert(error);
      else setProjects(projects);
    }
    fetchProjects();
  }, [user.id]);

  return (
    <div className="container">
      <div className="panel" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>你好, {user.username}!</h2>
            <div>
              {/* 如果是 admin，就顯示管理後台按鈕 */}
              {user.role === 'admin' && (
                <Link href="/admin" className="btn btn-purple" style={{marginRight: '10px'}}>
                  管理後台
                </Link>
              )}
              <button onClick={onLogout} className="btn" style={{background: '#666', color: 'white'}}>登出</button>
            </div>
        </div>
        <p>請選擇要標註的公司專案:</p>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
          {projects.map(p => {
            const total = parseInt(p.total_tasks, 10);
            const completed = parseInt(p.completed_tasks, 10);
            const percentage = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;
            return (
              <li key={p.id} style={{ margin: '15px 0', cursor: 'pointer' }} onClick={() => onProjectSelect(p)}>
                <div className="btn btn-primary" style={{ width: '100%', textAlign: 'left', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{p.name}</strong>
                    <span>{completed} / {total} ({percentage}%)</span>
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, background: '#10b981', height: '100%'}}></div>
                  </div>
                </div>
              </li>
            )
          })}
          {projects.length === 0 && <p>目前沒有可標註的專案。</p>}
        </ul>
      </div>
    </div>
  );
}

// 3. 標註主畫面元件
function AnnotationScreen({ user, project, onBack }) {
    const [currentItem, setCurrentItem] = useState(undefined); // undefined: 載入中, null: 已完成, object: 有任務
    const [progress, setProgress] = useState({ total: '?', completed: '?' });

    const [esgTypes, setEsgTypes] = useState([]);
    const [promiseStatus, setPromiseStatus] = useState('');
    const [verificationTimeline, setVerificationTimeline] = useState('');
    const [evidenceStatus, setEvidenceStatus] = useState('');
    const [evidenceQuality, setEvidenceQuality] = useState('');

    const dataTextRef = useRef(null);

    const loadTask = async () => {
        setCurrentItem(undefined); 
        const progressData = await getProjectsWithProgress(user.id);
        const currentProjectData = progressData.projects?.find(p => p.id === project.id);
        if (currentProjectData) {
            setProgress({ total: currentProjectData.total_tasks, completed: currentProjectData.completed_tasks });
        }

        const taskData = await getNextTaskForUser(project.id, user.id);
        if (taskData.error) {
            alert("讀取任務失敗: " + taskData.error);
            setCurrentItem(null);
        } else {
            setCurrentItem(taskData.task);
        }
    };

    useEffect(() => { loadTask(); }, [project, user.id]);

    useEffect(() => {
        if (currentItem) {
            setEsgTypes(currentItem.esg_type || []);
            setPromiseStatus(currentItem.promise_status || '');
            setVerificationTimeline(currentItem.verification_timeline || '');
            setEvidenceStatus(currentItem.evidence_status || '');
            setEvidenceQuality(currentItem.evidence_quality || '');
            if (dataTextRef.current) {
                dataTextRef.current.innerHTML = currentItem.original_data || '';
            }
        }
    }, [currentItem]);
    
    const handleSaveAndNext = async () => {
        if (!currentItem) return;

        const dataToSave = {
            source_data_id: currentItem.id,
            user_id: user.id,
            esg_type: esgTypes,
            promise_status: promiseStatus,
            promise_string: getHighlightedText('promise'),
            verification_timeline: verificationTimeline,
            evidence_status: evidenceStatus,
            evidence_string: getHighlightedText('evidence'),
            evidence_quality: evidenceQuality,
        };
        const result = await saveAnnotation(dataToSave);
        if (result.success) {
            loadTask();
        } else {
            alert("儲存失敗: " + result.error);
        }
    };

    const highlightSelection = (type) => {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = `highlight-${type}`;
        try {
            range.surroundContents(span);
        } catch (e) {
            alert('無法標記跨越不同區塊的文字');
        }
        selection.removeAllRanges();
    };

    const getHighlightedText = (type) => {
        if (!dataTextRef.current) return '';
        return Array.from(dataTextRef.current.querySelectorAll(`.highlight-${type}`))
            .map(el => el.textContent.trim())
            .join(' ');
    };
    
    const clearAllHighlights = () => {
        if (dataTextRef.current && currentItem) {
            dataTextRef.current.innerHTML = currentItem.original_data;
        }
    };

    const toggleEsgType = (type) => setEsgTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

    useEffect(() => { if (promiseStatus === 'No') { setVerificationTimeline('N/A'); setEvidenceStatus('N/A'); } }, [promiseStatus]);
    useEffect(() => { if (evidenceStatus !== 'Yes') setEvidenceQuality('N/A'); }, [evidenceStatus]);

    return (
        <div className="container">
            <div className="header">
                <h1>{project.name} - 標註工具</h1>
                <div className="controls">
                    <button onClick={onBack} className="btn">返回專案列表</button>
                    <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>標註者: {user.username}</span>
                </div>
                <div className="progress">
                    <span>您的個人進度: {progress.completed} / {progress.total}</span>
                    <div className="nav-btns">
                        <button 
                            className="nav-btn btn-emerald" // 將 btn-success 改為 btn-emerald
                            onClick={handleSaveAndNext} 
                            disabled={!currentItem}
                        >
                            儲存 & 下一筆
                        </button>
                    </div>
                </div>
            </div>

            {currentItem === undefined && <div className="panel"><h2>讀取中...</h2></div>}
            {currentItem === null && <div className="panel"><h2>恭喜！您已完成此專案的所有標註！</h2></div>}
            {currentItem && (
                <div className="content">
                    <div className="content-top">
                        <div className="panel">
                            <h2>文本內容 (ID: {currentItem.id})</h2>
                            <div className="info-box">用滑鼠選取文字後點擊下方按鈕: 黃色=承諾 / 藍色=證據</div>
                            <div ref={dataTextRef} className="text-area"></div>
                            <div className="highlight-btns">
                                <button className="highlight-btn highlight-btn-promise" onClick={() => highlightSelection('promise')}>標記承諾</button>
                                <button className="highlight-btn highlight-btn-evidence" onClick={() => highlightSelection('evidence')}>標記證據</button>
                                <button className="highlight-btn highlight-btn-clear" onClick={clearAllHighlights}>清除標記</button>
                            </div>
                        </div>
                        <div className="panel">
                            <h2>標註欄位</h2>
                            <div className="field">
                                <label>ESG 類型</label>
                                <div className="checkbox-group">
                                    <button className={`checkbox-btn ${esgTypes.includes('E') ? 'active' : ''}`} onClick={() => toggleEsgType('E')}>E</button>
                                    <button className={`checkbox-btn ${esgTypes.includes('S') ? 'active' : ''}`} onClick={() => toggleEsgType('S')}>S</button>
                                    <button className={`checkbox-btn ${esgTypes.includes('G') ? 'active' : ''}`} onClick={() => toggleEsgType('G')}>G</button>
                                </div>
                            </div>
                            <div className="field">
                                <label>承諾狀態</label>
                                <select value={promiseStatus} onChange={e => setPromiseStatus(e.target.value)}>
                                    <option value="">請選擇</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </div>
                            {promiseStatus === 'Yes' && (
                                <>
                                    <div className="field">
                                        <label>驗證時間軸</label>
                                        <select value={verificationTimeline} onChange={e => setVerificationTimeline(e.target.value)}>
                                            <option value="">請選擇</option>
                                            <option value="within_2_years">2年內</option>
                                            <option value="between_2_and_5_years">2-5年</option>
                                            <option value="longer_than_5_years">5年以上</option>
                                            <option value="already">已執行</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label>證據狀態</label>
                                        <select value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value)}>
                                            <option value="">請選擇</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    {evidenceStatus === 'Yes' && (
                                        <div className="field">
                                            <label>證據品質</label>
                                            <select value={evidenceQuality} onChange={e => setEvidenceQuality(e.target.value)}>
                                                <option value="">請選擇</option>
                                                <option value="Clear">清晰</option>
                                                <option value="Not Clear">不清晰</option>
                                                <option value="Misleading">誤導性</option>
                                                <option value="N/A">N/A</option>
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                     <div className="panel">
                       <PDFViewer 
                           pdfUrl={currentItem.source_url} 
                           pageNumber={currentItem.page_number}
                           bbox={currentItem.bbox}
                       />
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 主頁面元件，用於控制流程 ---
export default function HomePage() {
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('annotatorUser');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
        localStorage.removeItem('annotatorUser');
    }
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    localStorage.setItem('annotatorUser', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = () => {
      localStorage.removeItem('annotatorUser');
      setUser(null);
      setSelectedProject(null);
  };

  if (!user) {
    return <LoginRegisterScreen onLoginSuccess={handleLoginSuccess} />;
  }
  
  if (!selectedProject) {
    return <ProjectSelectionScreen user={user} onProjectSelect={setSelectedProject} onLogout={handleLogout} />;
  }

  return <AnnotationScreen user={user} project={selectedProject} onBack={() => setSelectedProject(null)} />;
}