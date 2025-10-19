```mermaid
graph TD
    A[使用者 User] -- 1. 發出請求 (Request) --> B(網址 URL)
    B -- 2. 匹配路由 --> C{視圖 View}
    C -- 3. 透過模型 Model 操作 --> D[(資料庫 Database)]
    D -- 4. 回傳數據 --> C
    C -- 5. 將數據傳入模板 --> E[模板 Template]
    E -- 6. 渲染成 HTML --> C
    C -- 7. 回應 (Response) --> A