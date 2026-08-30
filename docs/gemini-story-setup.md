# Tạo câu chuyện AI (Gemini) — thiết lập

Nút "Tạo câu chuyện AI" trong `TripView` cần một API key của Gemini. Không có
biến env bên dưới thì nút này tự ẩn (xem `geminiConfigured()` trong
[src/lib/gemini.ts](../src/lib/gemini.ts)) — app vẫn chạy bình thường, chỉ
thiếu tính năng này.

## 1. Lấy API key miễn phí

1. Vào https://aistudio.google.com/apikey → đăng nhập bằng tài khoản Google.
2. Bấm **Create API key** → chọn hoặc tạo một Google Cloud project (không cần
   gắn thẻ thanh toán — Gemini API có free tier riêng, không dùng chung hạn
   mức với các API cần billing như Maps).
3. Copy key vào `.env.local`:
   ```
   GEMINI_API_KEY=AIza...
   ```

## 2. Giới hạn

- Free tier có giới hạn số request/phút và số request/ngày (thay đổi theo
  model — xem https://ai.google.dev/gemini-api/docs/rate-limits). Đủ dùng cho
  demo/dùng cá nhân, không phù hợp cho traffic lớn không kiểm soát.
- Route `POST /api/trips/[slug]/story` chỉ chạy khi chủ sở hữu chuyến đi bấm
  nút (không tự động chạy khi tạo chuyến đi), nên chi phí/rate limit tỉ lệ
  với số lần bấm, không tỉ lệ với số lượt xem trang.
