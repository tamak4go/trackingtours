# Tracking Phượt

Upload ảnh chuyến đi → tự tính lộ trình từ GPS trong EXIF ảnh → có link chia sẻ công khai cho bạn bè xem lại (map animation + xem từng ảnh).

## Kiến trúc

- **Frontend**: Next.js (App Router) + Tailwind, MapLibre GL JS (vector map, style từ [OpenFreeMap](https://openfreemap.org) — miễn phí, không cần API key) cho animation "bay" theo lộ trình.
- **Xử lý ảnh**: đọc EXIF (`exifr`) và nén ảnh (`browser-image-compression`) hoàn toàn trên trình duyệt trước khi upload.
- **Routing**: gọi OSRM demo server công khai để tính quãng đường theo đường thực tế (fallback về đường chim bay nếu lỗi hoặc quá 100 điểm). Chỉ phù hợp prototype — xem ghi chú trong `src/lib/geo.ts`.
- **Backend**: Supabase (Postgres cho metadata chuyến đi + Storage cho ảnh đã nén). Không có hệ thống tài khoản — quyền sửa/xoá được xác thực bằng một "edit token" ngẫu nhiên cấp lúc tạo chuyến đi.

## Setup

1. Tạo project miễn phí tại [supabase.com](https://supabase.com).
2. Vào **SQL Editor** trong dashboard, chạy toàn bộ nội dung file [`supabase/schema.sql`](./supabase/schema.sql). File này tạo bảng `trips`/`photos` và storage bucket `trip-photos`.
3. Copy `.env.local.example` thành `.env.local`, điền 3 giá trị từ **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (giữ bí mật, không commit)
4. Chạy dev server:

```bash
npm run dev
```

5. Mở `http://localhost:3000`, chọn thư mục ảnh có GPS để test.

## Giới hạn hiện tại (MVP)

- OSRM demo server công khai không có SLA — nếu deploy thật nên tự host OSRM hoặc dùng dịch vụ trả phí (OpenRouteService, Mapbox Directions).
- Ảnh HEIC (mặc định trên iPhone) có thể không đọc/nén được tuỳ trình duyệt — nên khuyến khích người dùng chọn "ảnh gốc lớn nhất" dạng JPEG khi export từ iPhone.
- Không có tài khoản người dùng: ai có link xem là xem được (không kiểm soát quyền riêng tư chi tiết), ai có link "edit" là xoá được.
- Ảnh giới hạn 300 ảnh/chuyến đi trong API hiện tại (`src/app/api/trips/route.ts`).
