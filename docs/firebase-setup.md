# Lượt xem / thả tim (Firebase) — thiết lập

Bộ đếm "lượt xem" và nút "thả tim" trên trang chia sẻ chuyến đi cần một
Firebase project (Firestore). Không có các biến env bên dưới thì cả hai tự
ẩn (xem `firebaseConfigured()` trong [src/lib/firebase.ts](../src/lib/firebase.ts))
— app vẫn chạy bình thường, chỉ thiếu tính năng này. Hoàn toàn tách biệt với
Supabase (không đụng tới auth hay dữ liệu chuyến đi hiện có).

## 1. Tạo project miễn phí

1. Vào https://console.firebase.google.com/ → **Add project** → đặt tên
   (không cần bật Google Analytics) → gói mặc định là **Spark (miễn phí)**,
   không cần thẻ thanh toán.
2. Trong project, vào **Build → Firestore Database** → **Create database** →
   chọn **Start in production mode** (rules sẽ tự cấu hình ở bước 3) → chọn
   region gần Việt Nam (vd. `asia-southeast1`).
3. Vào **Project settings** (biểu tượng bánh răng) → tab **General** → mục
   **Your apps** → bấm biểu tượng **Web (`</>`)** → đặt tên app → **Register
   app**. Firebase hiện ra một object `firebaseConfig` — copy từng giá trị
   vào `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

## 2. Firestore security rules

App chỉ đọc/tăng dần đúng 2 field (`views`, `likes`) trên collection
`tripStats`, không có auth (khách vãng lai xem trang chia sẻ không đăng
nhập). Vào **Firestore Database → Rules** và dán:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tripStats/{slug} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasOnly(['views', 'likes'])
        && request.resource.data.views is int && request.resource.data.likes is int;
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views', 'likes']);
    }
  }
}
```

Việc này cho phép bất kỳ ai tăng `views`/`likes`, nhưng không cho ghi field
khác hay xoá document -- đủ cho bộ đếm công khai, không phải dữ liệu nhạy
cảm.

## 3. Giới hạn free tier (Spark)

50.000 lượt đọc + 20.000 lượt ghi Firestore mỗi ngày, không cần thẻ thanh
toán. Với quy mô một chuyến đi được vài trăm/nghìn lượt xem thì không bao
giờ chạm ngưỡng này.
