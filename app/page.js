// 檔案路徑: app/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { getNextTask, saveTask, getProgress } from './actions';

// 主應用程式元件
export default function AnnotatorPage() {
  const [userName, setUserName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(true);
  
  const [currentItem, setCurrentItem] = useState(null);
  const [progress, setProgress] = useState({ total: '?', completed: '?' });

  // 標註欄位的狀態
  const [esgTypes, setEsgTypes] = useState([]);
  const [promiseStatus, setPromiseStatus] = useState('');
  const [verificationTimeline, setVerificationTimeline] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState('');
  const [evidenceQuality, setEvidenceQuality] = useState('');

  const dataTextRef = useRef(null); // 用於操作文本區域

  // 載入任務和進度
  const loadTask = async (name) => {
    const progressData = await getProgress();
    if (!progressData.error) setProgress(progressData);

    const taskData = await getNextTask(name);
    if (taskData.error) {
        alert("讀取任務失敗: " + taskData.error);
        setCurrentItem(null);
    } else {
        setCurrentItem(taskData.task);
    }
  };
  
  // 當 currentItem 改變時，更新表單欄位
  useEffect(() => {
    if (currentItem) {
      setEsgTypes(currentItem.esg_type || []);
      setPromiseStatus(currentItem.promise_status || '');
      setVerificationTimeline(currentItem.verification_timeline || '');
      setEvidenceStatus(currentItem.evidence_status || '');
      setEvidenceQuality(currentItem.evidence_quality || '');
      if (dataTextRef.current) {
        dataTextRef.current.innerHTML = currentItem.original_data;
      }
    }
  }, [currentItem]);

  // 處理開始標註
  const handleStart = () => {
    if (userName.trim()) {
      setIsModalOpen(false);
      loadTask(userName.trim());
    } else {
      alert('請輸入名字');
    }
  };

  // 處理下一筆
  const handleNextItem = async () => {
    if (!currentItem) return;

    // 從 highlighed text 取得 promise_string 和 evidence_string
    const promiseString = getHighlightedText('promise');
    const evidenceString = getHighlightedText('evidence');
    
    const taskData = {
      id: currentItem.id,
      esg_type: esgTypes,
      promise_status: promiseStatus,
      promise_string: promiseString,
      verification_timeline: verificationTimeline,
      evidence_status: evidenceStatus,
      evidence_string: evidenceString,
      evidence_quality: evidenceQuality,
      annotator_name: userName,
    };
    
    const result = await saveTask(taskData);
    if(result.success) {
        alert('儲存成功！');
        loadTask(userName); // 載入下一筆
    } else {
        alert('儲存失敗: ' + result.error);
    }
  };

  // 處理 ESG 類型勾選
  const toggleEsgType = (type) => {
    setEsgTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  
  // 根據 Promise 狀態連動欄位
  useEffect(() => {
    if (promiseStatus === 'No') {
      setVerificationTimeline('N/A');
      setEvidenceStatus('N/A');
    }
  }, [promiseStatus]);

  // 根據 Evidence 狀態連動欄位
  useEffect(() => {
    if (evidenceStatus !== 'Yes') {
      setEvidenceQuality('N/A');
    }
  }, [evidenceStatus]);

  // --- 以下是原本的 highlight 相關函式 (稍作修改) ---
  const highlightSelection = (type) => {
    var selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      alert('請先用滑鼠選取文字');
      return;
    }
    var range = selection.getRangeAt(0);
    var span = document.createElement('span');
    span.className = (type === 'promise') ? 'highlight-promise' : 'highlight-evidence';
    try {
      range.surroundContents(span);
      selection.removeAllRanges();
    } catch (e) {
      alert('無法標記跨段落的文字');
    }
  };

  const getHighlightedText = (type) => {
    if (!dataTextRef.current) return '';
    const className = `highlight-${type}`;
    return Array.from(dataTextRef.current.getElementsByClassName(className))
      .map(el => el.textContent.trim())
      .join(' ');
  };
  
  const clearAllHighlights = () => {
    if (dataTextRef.current && currentItem) {
      dataTextRef.current.innerHTML = currentItem.original_data;
    }
  };

  if (isModalOpen) {
    return (
      <div className="modal" style={{ display: 'block' }}>
        <div className="modal-content">
          <h2>開始標註</h2>
          <label>請輸入您的名字:</label>
          <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="例如:王小明" />
          <button onClick={handleStart}>開始</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>ESG 報告標註工具</h1>
        <div>
          <p><strong>標註者:</strong> {userName}</p>
          <p><strong>進度:</strong> {progress.completed} / {progress.total}</p>
        </div>
        <button className="nav-btn" onClick={handleNextItem} disabled={!currentItem}>儲存並到下一筆</button>
      </div>

      {!currentItem ? (
        <div className="panel"><h2>恭喜！所有任務已完成！</h2></div>
      ) : (
        <div className="content">
          <div className="content-top">
            <div className="panel">
              <h2>文本內容 (ID: {currentItem.id})</h2>
              <div className="info-box">用滑鼠選取文字後點擊下方按鈕:黃色=承諾 / 藍色=證據</div>
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
                  <button className={`checkbox-btn ${esgTypes.includes('E') ? 'active' : ''}`} onClick={() => toggleEsgType('E')}>E (環境)</button>
                  <button className={`checkbox-btn ${esgTypes.includes('S') ? 'active' : ''}`} onClick={() => toggleEsgType('S')}>S (社會)</button>
                  <button className={`checkbox-btn ${esgTypes.includes('G') ? 'active' : ''}`} onClick={() => toggleEsgType('G')}>G (治理)</button>
                </div>
              </div>
              <div className="field">
                <label>承諾狀態</label>
                <select value={promiseStatus} onChange={e => setPromiseStatus(e.target.value)}>
                    <option value="">請選擇</option>
                    <option value="Yes">Yes - 有承諾</option>
                    <option value="No">No - 無承諾</option>
                </select>
              </div>
              {promiseStatus === 'Yes' && (
                <>
                  <div className="field">
                    <label>驗證時間軸</label>
                    <select value={verificationTimeline} onChange={e => setVerificationTimeline(e.target.value)}>
                        <option value="">請選擇</option>
                        <option value="within_2_years">within_2_years</option>
                        <option value="between_2_and_5_years">between_2_and_5_years</option>
                        <option value="longer_than_5_years">longer_than_5_years</option>
                        <option value="already">already</option>
                        <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>證據狀態</label>
                    <select value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value)}>
                        <option value="">請選擇</option>
                        <option value="Yes">Yes - 有證據</option>
                        <option value="No">No - 無證據</option>
                        <option value="N/A">N/A</option>
                    </select>
                  </div>
                  {evidenceStatus === 'Yes' && (
                     <div className="field">
                        <label>證據品質</label>
                        <select value={evidenceQuality} onChange={e => setEvidenceQuality(e.target.value)}>
                            <option value="">請選擇</option>
                            <option value="Clear">Clear - 清晰</option>
                            <option value="Not Clear">Not Clear - 不清晰</option>
                            <option value="Misleading">Misleading - 誤導性</option>
                            <option value="N/A">N/A</option>
                        </select>
                     </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="panel">
             <h2>PDF 預覽</h2>
             <p>PDF 預覽功能需要進一步設定雲端儲存，暫時移除。</p>
             <p><strong>當前任務的 PDF 路徑:</strong> {currentItem.source_url}</p>
          </div>
        </div>
      )}
    </div>
  );
}