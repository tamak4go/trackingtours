# Xuất ra Google Sheets — thiết lập

Nút "Xuất ra Google Sheets" trong `TripView` cần một Google OAuth Client ID
(web). Không có biến env bên dưới thì nút này tự ẩn (xem
`googleSheetsExportConfigured()` trong
[src/lib/google-sheets-export.ts](../src/lib/google-sheets-export.ts)) — app
vẫn chạy bình thường, chỉ thiếu tính năng này.

Khác với các mục khác: tính năng này **không** cần server-side credentials —
mỗi lần bấm nút, trình duyệt của người xem trang sẽ mở popup xin quyền Google
Sheets bằng **chính tài khoản Google của họ** (Google Identity Services),
rồi tạo sheet mới trong Drive của họ. Không cần Firebase project ở bước
trước, đây là một Google Cloud project riêng (có thể trùng project với
Gemini nếu muốn).

## 1. Tạo OAuth Client ID miễn phí

1. Vào https://console.cloud.google.com/ → chọn hoặc tạo project (không cần
   billing).
2. Vào **APIs & Services → Library**, tìm **Google Sheets API** → **Enable**.
3. Vào **APIs & Services → OAuth consent screen**:
   - User type: **External** (trừ khi bạn dùng Google Workspace tổ chức).
   - Điền tên app, email hỗ trợ. Ở bước **Scopes**, không cần thêm gì (scope
     `spreadsheets` được xin runtime, incremental).
   - Ở bước **Test users** (khi app còn ở "Testing"), thêm chính email Google
     của bạn để test được — app ở trạng thái Testing chỉ những email này mới
     xin quyền được, người lạ sẽ bị chặn cho tới khi bạn **Publish app**
     (không cần Google duyệt nếu chỉ xin scope Sheets, đây là scope
     "non-sensitive").
4. Vào **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: thêm domain thật (vd.
     `https://trackingphuot.vercel.app`) và `http://localhost:3000` để test
     local.
   - Bấm **Create**, copy **Client ID** vào `.env.local`:
     ```
     NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
     ```

## 2. Lưu ý

- Scope `https://www.googleapis.com/auth/spreadsheets` là "sensitive" theo
  phân loại của Google nhưng không "restricted" -- app ở trạng thái
  **Testing** vẫn dùng được ngay với các tài khoản trong danh sách **Test
  users**, không cần đợi Google duyệt để demo/nộp bài thi.
- Nếu muốn public thật (ai cũng bấm được, không chỉ test users), cần bấm
  **Publish app** ở OAuth consent screen — Google có thể yêu cầu xác minh bổ
  sung do đây là sensitive scope, nhưng không bắt buộc để chạy ở chế độ
  Testing.
