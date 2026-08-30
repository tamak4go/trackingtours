# Bản Google AI Studio song song — spec để dán vào AI Studio/Antigravity

Mục này dành cho mục bắt buộc trong form nộp bài AI Riser Vietnam 2026:
**"AI Studio Link — sản phẩm được xây dựng bằng Google AI Studio"**. Vì app
chính (Tracking Phượt, Next.js) là code tay chứ không build trong AI Studio,
đây là một **app đồng hành nhỏ, độc lập**, xây trực tiếp trong Google AI
Studio (aistudio.google.com → **Build**) hoặc Google Antigravity, để vừa
thoả mãn checklist vừa cho thấy cách khai thác Gemini một cách sáng tạo.

Không cần đạt tính năng ngang bằng app chính — mục tiêu là một trải nghiệm
gọn, chạy được, thể hiện rõ ý tưởng "kể lại chuyến phượt bằng AI từ ảnh".

## Cách dùng

1. Vào https://aistudio.google.com/ → **Build** (hoặc mở Google Antigravity).
2. Dán nguyên văn phần **"Prompt để dán"** bên dưới vào ô mô tả app.
3. Sau khi AI Studio dựng xong bản đầu, thử tải lên vài ảnh thật từ điện
   thoại của bạn (ảnh có định vị hoặc không đều được) để xem kết quả, rồi
   tinh chỉnh prompt/UI nếu cần.
4. Lấy link app AI Studio (Share hoặc link Build) điền vào mục **AI Studio
   Link** của form.

## Prompt để dán

```
Xây một web app tên "Tracking Phượt Mini" bằng tiếng Việt, chủ đề phượt xe
máy Việt Nam. Chức năng chính:

1. Người dùng tải lên (kéo-thả hoặc chọn file) 3-10 ảnh chụp trong một
   chuyến đi xe máy.
2. Người dùng có thể gõ thêm vài dòng ghi chú tự do cho từng ảnh hoặc cho cả
   chuyến đi (địa danh, thời gian, cảm xúc) — không bắt buộc.
3. Dùng Gemini (multimodal, đọc trực tiếp nội dung ảnh) để:
   - Đoán thứ tự hợp lý của các ảnh nếu chưa được sắp xếp theo timeline
     (dựa trên gợi ý thị giác: ánh sáng, phong cảnh thay đổi dần, v.v., cộng
     với ghi chú người dùng nếu có).
   - Viết một đoạn "nhật ký hành trình" bằng tiếng Việt, giọng văn gần gũi,
     kể lại chuyến đi như một câu chuyện liền mạch, chia theo từng ảnh/điểm
     dừng.
4. Hiển thị kết quả dạng dòng thời gian (timeline) cuộn dọc: mỗi điểm dừng
   là một ảnh lớn kèm đoạn văn Gemini viết cho điểm đó, sắp xếp theo thứ tự
   đã đoán.
5. Có nút "Viết lại" để gọi lại Gemini với cùng ảnh nhưng một giọng văn khác
   (vd: hài hước / trầm lắng / chi tiết).

Phong cách UI: nền tối (dark), điểm nhấn màu cam/vàng ánh nắng đường trường,
font hiện đại, cảm giác như một cuốn sổ tay du hành số hoá — không cần bản
đồ hay định vị GPS thật, đây là bản trải nghiệm nhẹ tập trung vào phần kể
chuyện bằng AI, khác với bản đầy đủ (có bản đồ, route thật) đang chạy ở nơi
khác.
```

## Vì sao tách biệt với app chính

App chính (`../README.md`) đã có toàn bộ pipeline route-từ-EXIF, bản đồ,
video export — phần đó không phù hợp để build lại từ đầu trong AI Studio
(không có backend/DB riêng, không đọc EXIF ảnh gốc dễ dàng). Bản AI Studio
này đóng vai trò minh chứng kỹ năng dùng Gemini một cách sáng tạo, độc lập
với hạ tầng Next.js/Supabase của app chính — đúng tinh thần "được xây dựng
bằng Google AI Studio" mà form yêu cầu.
