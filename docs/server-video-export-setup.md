# Xuất video "chuẩn (server)" — thiết lập

Nút **"Xuất chuẩn (server)"** trong `TripView` cần một dịch vụ riêng
(`render-service/`) deploy tách biệt khỏi app Next.js chính (Puppeteer +
ffmpeg không chạy được trên runtime serverless của Vercel). Không có 2 biến
env `RENDER_SERVICE_URL` / `RENDER_SERVICE_SECRET` thì nút này tự ẩn (xem
`GET /api/render-video` trong
[src/app/api/render-video/route.ts](../src/app/api/render-video/route.ts)) —
app vẫn chạy bình thường, "Xuất nhanh" và "Xuất mượt" (2 nút xuất video phía
client, không cần thiết lập gì) vẫn hoạt động độc lập.

## Vì sao lại cần dịch vụ riêng

"Xuất nhanh" (quay màn hình) và "Xuất mượt" (canvas) đều capture animation
đang chạy **thật** trên máy người xem — nên chất lượng phụ thuộc máy/tab lúc
đó đang bận gì. `render-service/` giải quyết việc này bằng cách không quay
gì cả: nó mở một Chromium headless, load lại chính trang chuyến đi ở chế độ
`?render=1` (xem effect `renderMode` trong
[TripView.tsx](../src/components/TripView.tsx)), rồi tự bước animation từng
khung hình một qua `window.__advanceFrame()` — không có đồng hồ thật, nên dù
máy render chậm cỡ nào, video ra vẫn y hệt nhau. ffmpeg ghép các khung hình
tĩnh đó lại thành video 30fps thật.

## 1. Tạo Web Service trên Render.com

1. Push nhánh có `render.yaml` (đã có sẵn ở gốc repo) lên GitHub.
2. Vào https://dashboard.render.com/ → **New** → **Blueprint** → chọn repo
   này. Render tự đọc [render.yaml](../render.yaml) và đề nghị tạo 1 web
   service tên `trackingtours-render`, chạy Docker từ thư mục
   `render-service/`, gói **Free**.
3. Điền 4 biến env Render sẽ hỏi (đều đánh dấu bí mật, không commit):
   - `RENDER_SECRET` — chuỗi bí mật tự chọn (vd `openssl rand -hex 32`).
     Phải khớp với `RENDER_SERVICE_SECRET` ở app Next.js (bước 2).
   - `APP_BASE_URL` — domain app Next.js đã deploy (vd
     `https://trackingtours.vercel.app`) — dịch vụ này sẽ tự load
     `/t/[slug]?render=1` từ đó.
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — copy đúng giá
     trị đang dùng ở app Next.js (Project Settings > API trên Supabase).
4. Deploy xong, Render cho một URL dạng
   `https://trackingtours-render.onrender.com` — đó là `RENDER_SERVICE_URL`.

## 2. Trỏ app Next.js sang dịch vụ vừa tạo

Thêm vào `.env.local` (local) và biến môi trường trên Vercel (production):

```
RENDER_SERVICE_URL=https://trackingtours-render.onrender.com
RENDER_SERVICE_SECRET=<đúng giá trị RENDER_SECRET ở bước 1>
```

Nút "Xuất chuẩn (server)" sẽ tự hiện ra trong menu "..." của trang chuyến đi
sau khi deploy lại.

## 3. Bucket Supabase Storage cho video

`render-service` tự tạo bucket `trip-videos` (public) ở lần render đầu tiên
nếu chưa có (xem `ensureBucket()` trong
[render-service/src/render.js](../render-service/src/render.js)) — không
cần tạo tay, chỉ cần `SUPABASE_SERVICE_ROLE_KEY` có quyền tạo bucket (service
role key luôn có).

## 4. Giới hạn của gói Free trên Render.com

- **Tự ngủ sau ~15 phút không có traffic**, lần request đầu sau đó phải đợi
  cold start (vài chục giây) trước khi job bắt đầu chạy. App Next.js poll
  trạng thái job mỗi ~2.5s trong lúc chờ (xem `exportVideoServer` trong
  TripView.tsx) — traffic đó cũng giữ cho instance không bị ngủ giữa chừng
  một job đang chạy.
- **512MB RAM / CPU dùng chung** — render một chuyến đi dài (nhiều điểm
  dừng, animation ~25s) có thể mất vài phút thay vì vài giây, vì mỗi khung
  hình cần Chromium chụp ảnh + ffmpeg encode trên CPU yếu. Đây là đánh đổi
  chấp nhận được cho quy mô cá nhân — không phù hợp nếu kỳ vọng xuất video
  tức thời cho nhiều người dùng cùng lúc.
- **Job lưu trong bộ nhớ (in-memory), không có queue/DB riêng** — nếu Render
  khởi động lại instance (redeploy, hoặc tự phục hồi sau sự cố) đúng lúc có
  job đang chạy, job đó mất, người dùng cần bấm xuất lại. Chấp nhận được ở
  quy mô hiện tại; không phải thứ nên giữ nguyên nếu sau này cần độ tin cậy
  cao hơn.

## 5. Nếu chưa muốn thiết lập dịch vụ này

Bỏ qua toàn bộ phần trên — nút "Xuất chuẩn (server)" sẽ không hiện, nhưng
"Xuất nhanh" và "Xuất mượt" vẫn hoạt động đầy đủ ngay trong trình duyệt,
không cần bất kỳ thiết lập nào ở trên.
