# Đăng lên TikTok — thiết lập

Nút "Đăng lên TikTok" trong `TripView` cần một TikTok Developer App. Không có
2 biến env bên dưới thì nút này tự ẩn (xem `tiktokConfigured()` trong
[src/lib/tiktok.ts](../src/lib/tiktok.ts)) — app vẫn chạy bình thường, chỉ
thiếu tính năng này.

## 1. Tạo app trên TikTok for Developers

1. Vào https://developers.tiktok.com/ → đăng nhập → **Manage apps** → **Create an app**.
2. Ở tab **Products**, thêm **Login Kit** và **Content Posting API**.
3. Ở **Login Kit → Redirect URI**, thêm đúng:
   `https://<domain-cua-ban>/api/tiktok/callback` (và bản `http://localhost:3000/api/tiktok/callback` nếu test local).
4. Copy **Client key** và **Client secret** vào `.env.local`:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   ```

## 2. Giới hạn quan trọng: app chưa audit chỉ đăng được vào "Bản nháp"

TikTok chỉ cho app đã qua **audit thủ công** (đăng ký "Direct Post", giải
trình rõ use case, chờ TikTok duyệt — thường vài ngày đến vài tuần) được
đăng thẳng lên profile người dùng. Trước khi được duyệt, Content Posting API
chỉ cho phép gửi video vào **hộp thư đến (inbox) của người dùng dưới dạng
bản nháp** — người dùng vẫn phải tự mở app TikTok, vào **Hộp thư đến > Bản
nháp**, và bấm **Đăng** để video thực sự lên public.

Code trong repo này (`uploadToInbox` trong `src/lib/tiktok.ts`, gọi
`/v2/post/publish/inbox/video/init/`) dùng đúng luồng "bản nháp" đó — luồng
duy nhất khả dụng ngay mà không cần chờ TikTok duyệt app. Đây không phải
giới hạn của code, mà là giới hạn cứng từ chính sách của TikTok.

Trong lúc app còn ở chế độ "Development" trên TikTok for Developers, chỉ
những tài khoản TikTok bạn khai báo làm **test user** trong dashboard mới
đăng nhập/đăng bài được — người dùng khác sẽ bị TikTok từ chối ở bước OAuth.
Muốn mở cho công chúng dùng thật thì phải nộp app xin **App review** (mục
riêng, khác với audit "Direct Post").

## 3. Giới hạn dung lượng video

Server nhận video ở `POST /api/tiktok/upload` dưới dạng raw bytes trong
request body (không multipart). Nếu deploy trên Vercel bằng Node runtime,
Vercel giới hạn body request khoảng 4.5 MB — một clip ngắn (vài chục giây,
1280x720) thường vẫn lọt qua, nhưng recording dài/độ phân giải cao có thể
vượt và bị chặn ở tầng platform trước khi vào tới route handler (lỗi 413).
Nếu gặp trường hợp này, cân nhắc nén video phía client trước khi gửi, hoặc
tăng giới hạn body qua cấu hình host.

## 4. Refresh token

Access token TikTok hết hạn sau vài giờ; refresh token sống khoảng 1 năm.
`/api/tiktok/upload` tự refresh khi cần (xem `refreshAccessToken` trong
`src/lib/tiktok.ts`) — người dùng không phải đăng nhập lại mỗi lần, trừ khi
refresh token cũng hết hạn hoặc bị TikTok thu hồi (khi đó API trả 401 và
nút chuyển lại thành "Kết nối TikTok").

## 5. Nếu chưa có app TikTok Developer

Bỏ qua 2 biến env ở trên — nút "Đăng lên TikTok" sẽ không hiện, nhưng nút
"Xuất video" (biểu tượng camera) vẫn hoạt động độc lập: nó quay lại animation
thành file, và trên điện thoại sẽ mở bảng chia sẻ của hệ điều hành (Web
Share API) để người dùng tự chọn TikTok và đăng thủ công — không cần bất kỳ
thiết lập nào ở trên.
