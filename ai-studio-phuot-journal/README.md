# Nhật Ký Phượt AI — AI Riser Vietnam 2026 submission

App nhỏ dùng Gemini để biến ghi chú thô của một chuyến phượt (cung đường, số ngày,
khoảnh khắc) thành nhật ký hành trình, gợi ý lịch trình cho người đi sau, và caption
sẵn để đăng mạng xã hội.

## 1. Chạy thử ở local

```bash
npm install
cp .env.local.example .env.local
# rồi điền GEMINI_API_KEY vào .env.local (lấy key tại aistudio.google.com/apikey)
npm run dev
```

## 2. Đưa vào Google AI Studio (bắt buộc để có "AI Studio Link")

Thể lệ yêu cầu sản phẩm phải được *xây dựng bằng* Google AI Studio, nên bước này
phải làm thủ công trên [aistudio.google.com](https://aistudio.google.com) — Claude
Code không thể thao tác trực tiếp trong web tool đó.

1. Vào AI Studio → **Build** → tạo app mới.
2. Copy nội dung 3 file cốt lõi ở đây sang: `src/types.ts`, `src/services/geminiService.ts`,
   `src/App.tsx` (và `src/App.css` nếu muốn giữ nguyên giao diện). AI Studio tự inject
   `process.env.API_KEY`, nên không cần sửa gì trong `geminiService.ts`.
3. Chạy thử trực tiếp trong AI Studio, chỉnh prompt/giao diện nếu muốn.
4. Bấm **Share** để lấy link AI Studio công khai — đây là link nộp vào mục "AI Studio Link".

## 3. Deploy lên Cloud Run (bonus 10 điểm)

Có 2 cách, chọn 1:

**Cách A — nút Deploy trong AI Studio**: sau bước 2, AI Studio có tùy chọn
"Deploy to Cloud Run" ngay trong giao diện Build — nhanh nhất, khuyên dùng.

**Cách B — deploy thủ công từ project này** (dùng khi muốn kiểm soát Dockerfile/nginx
đã có sẵn trong repo):

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/phuot-ai-journal \
  --substitutions=_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

gcloud run deploy phuot-ai-journal \
  --image gcr.io/YOUR_PROJECT_ID/phuot-ai-journal \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated
```

Nếu build local bằng Docker trước khi submit lên Cloud Build:

```bash
docker build --build-arg GEMINI_API_KEY=YOUR_GEMINI_API_KEY \
  -t phuot-ai-journal .
docker run -p 8080:8080 phuot-ai-journal
```

> Lưu ý bảo mật: vì đây là app tĩnh (không có backend), API key bị bake vào bundle
> lúc build và lộ ra ở client — đúng như cách AI Studio Build tự làm mặc định. Nên
> giới hạn quota/restrict theo domain cho key này trong Google Cloud Console trước
> khi public link.

## 4. Checklist nộp form

- [ ] AI Studio Link (public)
- [ ] Demo video YouTube (Công khai)
- [ ] Social post kèm video + hành trình làm sản phẩm
- [ ] (Bonus) Link Cloud Run public
