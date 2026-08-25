import Link from "next/link";

export const metadata = { title: "Điều khoản dịch vụ · Tracking Phượt" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-md-background text-on-surface">
      <div className="bg-mesh" />
      <div className="relative max-w-2xl mx-auto px-6 py-14">
        <Link href="/" className="text-sm text-secondary hover:underline">
          ← Về trang chủ
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-1">Điều khoản dịch vụ</h1>
        <p className="text-sm text-on-surface-variant mb-8">Terms of Service — Tracking Phượt</p>

        <div className="glass rounded-2xl p-6 flex flex-col gap-5 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-on-surface font-semibold mb-1">1. Dịch vụ là gì</h2>
            <p>
              Tracking Phượt là một công cụ miễn phí giúp bạn tải lên ảnh chuyến đi (hoặc file ZIP xuất từ Google
              Takeout), tự động đọc vị trí GPS trong ảnh để dựng lộ trình, và tạo một link chia sẻ có animation
              &quot;xe chạy&quot; dọc theo lộ trình đó. Đây là dự án cá nhân, không phải dịch vụ thương mại có SLA
              hay hỗ trợ chính thức.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">2. Tài khoản</h2>
            <p>
              Bạn có thể dùng phần lớn tính năng mà không cần tài khoản (dữ liệu chuyến đi lưu trên trình duyệt).
              Đăng nhập bằng Google là tùy chọn, giúp đồng bộ chuyến đi giữa nhiều thiết bị.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">3. Nội dung bạn tải lên</h2>
            <p>
              Bạn chịu trách nhiệm về ảnh mình tải lên — chỉ tải ảnh bạn có quyền sử dụng và chia sẻ. Chuyến đi đặt
              ở chế độ &quot;công khai&quot; có thể xem được bởi bất kỳ ai có link, hoặc xuất hiện ở trang
              Explore/Community. Bạn có thể xoá chuyến đi bất kỳ lúc nào từ trang quản lý chuyến đi đó.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">4. Tích hợp TikTok</h2>
            <p>
              Nếu bạn chọn kết nối tài khoản TikTok, ứng dụng chỉ gửi video hành trình bạn vừa quay lên TikTok khi
              bạn chủ động bấm &quot;Đăng lên TikTok&quot; — video đó được gửi vào Hộp thư đến/Bản nháp của chính
              tài khoản TikTok của bạn, bạn phải tự mở app TikTok và bấm Đăng để công khai. Ứng dụng không tự động
              đăng bài thay bạn, không đọc hay chỉnh sửa nội dung khác trên tài khoản TikTok của bạn.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">5. Không bảo đảm</h2>
            <p>
              Dịch vụ được cung cấp &quot;nguyên trạng&quot;, không cam kết luôn sẵn sàng 100% hay không có lỗi.
              Bản đồ và tính khoảng cách dùng dữ liệu/dịch vụ bên thứ ba (OSRM, bản đồ nền) có thể có sai số.
            </p>
          </section>

          <section>
            <h2 className="text-on-surface font-semibold mb-1">6. Liên hệ</h2>
            <p>Có thắc mắc về điều khoản này, xem thêm ở trang Help hoặc liên hệ qua email tài khoản chủ dự án.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
