import Link from "next/link";

export const metadata = { title: "Chính sách quyền riêng tư · Tracking Phượt" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-md-background text-on-surface">
      <div className="bg-mesh" />
      <div className="relative max-w-2xl mx-auto px-6 py-14">
        <Link href="/" className="text-sm text-secondary hover:underline">
          ← Về trang chủ
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-1">Chính sách quyền riêng tư</h1>
        <p className="text-sm text-on-surface-variant mb-8">Privacy Policy — Tracking Phượt</p>

        <div className="glass rounded-2xl p-6 flex flex-col gap-5 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-on-surface font-semibold mb-1">1. Dữ liệu chúng tôi xử lý</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ảnh bạn tải lên (bao gồm dữ liệu EXIF: toạ độ GPS, thời gian chụp) — lưu trên Supabase Storage.</li>
              <li>Toạ độ/lộ trình tính từ ảnh, và tên chuyến đi bạn đặt.</li>
              <li>
                Nếu đăng nhập bằng Google: email và tên hiển thị, dùng để gắn chuyến đi với tài khoản của bạn.
              </li>
              <li>
                Nếu kết nối TikTok: access token/refresh token của TikTok, lưu trong cookie httpOnly trên trình
                duyệt của bạn (không lưu trên server) — chỉ dùng để gửi video bạn yêu cầu lên TikTok.
              </li>
              <li>Không lưu địa chỉ IP dài hạn — chỉ dùng tạm thời để giới hạn số lượt tải lên mỗi ngày.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">2. Chúng tôi dùng dữ liệu để làm gì</h2>
            <p>
              Chỉ để vận hành tính năng của app: dựng lộ trình, hiển thị bản đồ/animation, cho phép bạn chia sẻ
              chuyến đi qua link, và (nếu bạn yêu cầu) đăng video lên TikTok của chính bạn. Chúng tôi không bán,
              không chia sẻ dữ liệu cho bên thứ ba ngoài các dịch vụ hạ tầng cần thiết (Supabase để lưu trữ, TikTok
              chỉ khi bạn chủ động kết nối, OSRM/bản đồ nền công khai để tính đường đi).
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">3. Chia sẻ công khai</h2>
            <p>
              Chuyến đi bạn đặt ở chế độ &quot;công khai&quot; hiển thị được cho bất kỳ ai có link, kể cả ảnh và vị
              trí chụp. Đặt &quot;riêng tư&quot; nếu không muốn vậy — có thể đổi bất kỳ lúc nào từ trang chuyến đi.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">4. Xoá dữ liệu</h2>
            <p>
              Bấm &quot;Xoá&quot; trên trang chuyến đi để xoá vĩnh viễn ảnh và dữ liệu chuyến đi đó khỏi server. Bấm
              &quot;Ngắt kết nối&quot; TikTok để xoá cookie token TikTok khỏi trình duyệt của bạn ngay lập tức.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">5. Liên hệ</h2>
            <p>Có câu hỏi về dữ liệu của bạn, xem thêm ở trang Help hoặc liên hệ qua email tài khoản chủ dự án.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
