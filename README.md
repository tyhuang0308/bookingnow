# 線上預約網站：設定說明

這個網站放在 GitHub Pages 上，預約資料存在 Firebase。兩者都是免費方案。

- **家長預約頁**：`https://你的帳號.github.io/儲存庫名稱/`
  不需要登入，就能看到每位老師的空檔並預約。預約成功後會拿到 8 碼預約代碼，可以用代碼查詢或取消。
- **老師後台**：`https://你的帳號.github.io/儲存庫名稱/admin.html`
  用 Google 帳號登入。家長頁上沒有任何通往後台的連結。即使有人找到這個網址，沒有被加入名單的帳號也進不去。

整個設定大約需要 20 分鐘，只要做一次。

---

## 一、建立 Firebase 專案（存放資料）

1. 打開 <https://console.firebase.google.com>，用你的 Google 帳號登入，按「建立專案」。
   - 專案名稱可以自己取，例如 `ot-booking`。
   - Google Analytics 可以關閉。
2. **建立資料庫**
   1. 左側選單選「建構」→「Firestore Database」→「建立資料庫」。
   2. 位置選 `asia-east1 (台灣)`。
   3. 模式選「以正式版模式啟動」。
3. **貼上安全規則**
   1. 在 Firestore 頁面上方點「規則」，把原本的內容全部刪掉。
   2. 貼上 `firestore.rules` 檔案的全部內容。
   3. 把第 9 行的 `your-name@gmail.com` 改成你自己的 Gmail，全部小寫。
   4. 按「發布」。
4. **開啟 Google 登入**
   1. 左側選「建構」→「Authentication」→「開始使用」。
   2. 在「登入方式」選「Google」，按「啟用」。
   3. 選擇專案支援 Email（選你自己的），然後儲存。
5. **取得網站設定**
   1. 點左上角齒輪 →「專案設定」→「一般」。
   2. 在最下方「你的應用程式」點 `</>`（網頁）圖示，輸入任意暱稱，按「註冊應用程式」。不用勾選 Firebase Hosting。
   3. 畫面會出現一段 `const firebaseConfig = { apiKey: "...", ... }`。打開 `config.js`，把這 6 個值逐一複製到對應的引號裡，然後存檔。

> `config.js` 裡的這些值本來就會公開在網頁上，不是密碼。真正保護資料的是第 3 步的安全規則。

## 二、放上 GitHub Pages（架設網站）

1. 到 <https://github.com> 註冊或登入，右上角「＋」→「New repository」。
   - Repository name：例如 `booking`。
   - 選 **Public**（免費帳號要公開，GitHub Pages 才能使用；程式碼裡沒有任何個人資料或密碼）。
   - 按「Create repository」。
2. 在新的儲存庫頁面點「uploading an existing file」。把這個資料夾裡的檔案全部拖進去，包括已經改好的 `config.js`，然後按「Commit changes」。
3. 到儲存庫的「Settings」→ 左側「Pages」：
   - Source：Deploy from a branch
   - Branch：`main`、資料夾 `/ (root)`，按「Save」。
   - 大約 1 到 2 分鐘後，上方會出現網站網址。
4. **讓 Google 登入可以在這個網址使用**：回到 Firebase →「Authentication」→「設定」→「已授權網域」→「新增網域」，填入 `你的帳號.github.io`（不用加 https:// 和後面的路徑）。

## 三、開始使用

1. 打開 `.../admin.html`，用你在規則裡寫的那個 Gmail 登入。
2. 在「頁面設定」填寫名稱、簡介和聯絡方式。
3. 在「人員與時段」新增老師，並設定每段時長和每週開放的時段。
4. 在「老師帳號」加入其他老師的 Gmail。他們就能用自己的帳號登入後台，所有老師的權限都相同。
5. 用手機打開家長頁，自己預約一次，再到後台的「預約紀錄」確認有沒有出現。

## 之後要修改

- **修改網站內容或程式**：在 GitHub 上點檔案 → 鉛筆圖示編輯 →「Commit changes」，1 到 2 分鐘後網站就會更新。
- **更換網站擁有者帳號**：修改 Firebase 規則第 9 行，然後按「發布」。

## 需要知道的限制

- 免費方案不會自動寄 Email 通知。新預約會即時出現在後台，不用重新整理頁面。後台的「預約紀錄」也可以匯出 CSV，用 Excel 開啟。
- 系統沒有限制同一個人可以預約幾筆。如果有人亂約，老師可以在後台取消。
- 後台列出今天起的預約。匯出的 CSV 包含最近兩週起的紀錄。舊資料都保留在 Firestore 裡，不會被刪除。
- 免費額度：每天 5 萬次讀取、2 萬次寫入，一般診所或工作室使用遠遠用不完。
