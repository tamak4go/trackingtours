"use client";

import { HelpCircle, Mail } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Làm sao để tạo một chuyến đi?",
    a: 'Bấm "Khởi hành ngay" hoặc "Start Ride", chọn ảnh chụp trong chuyến đi (có GPS trong EXIF, hoặc từ Google Takeout). Hệ thống tự đọc toạ độ và thời gian chụp để dựng lộ trình.',
  },
  {
    q: "Tại sao lộ trình bị vẽ thành đường thẳng thay vì đường thực tế?",
    a: "Dịch vụ tính đường đi thực (OSRM) đôi khi lỗi tạm thời lúc tạo chuyến đi. Chủ chuyến đi có thể bấm nút tính lại đường thực ngay trên trang chuyến đi.",
  },
  {
    q: "Chuyến đi công khai và riêng tư khác nhau thế nào?",
    a: "Chuyến đi công khai xuất hiện ở Explore/Community và ai có link cũng xem được. Chuyến đi riêng tư chỉ mở được bằng link quản lý hoặc khi đăng nhập đúng tài khoản chủ sở hữu.",
  },
  {
    q: "Tôi không đăng nhập thì dữ liệu lưu ở đâu?",
    a: "Danh sách chuyến đi được lưu trên trình duyệt hiện tại (localStorage). Đăng nhập bằng Google để lưu vào tài khoản, dùng được trên nhiều thiết bị và các trang Gallery/Stats/Map View.",
  },
  {
    q: "Làm sao xoá một chuyến đi?",
    a: "Vào trang chuyến đi (cần quyền chỉnh sửa), bấm nút Xoá ở thanh công cụ trên cùng. Thao tác này xoá vĩnh viễn ảnh và dữ liệu trên server.",
  },
];

export default function HelpPage() {
  return (
    <DashboardShell active="help">
      <div className="w-full max-w-2xl mt-10 sm:mt-14 pb-10">
        <div className="flex items-center gap-2.5 mb-2">
          <HelpCircle size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Help</h1>
        </div>
        <p className="text-muted text-sm mb-8">Câu hỏi thường gặp về Tracking Phượt.</p>

        <div className="flex flex-col gap-3 mb-8">
          {FAQS.map((item) => (
            <details key={item.q} className="glass rounded-2xl p-4 group">
              <summary className="text-sm font-semibold text-white/85 cursor-pointer list-none flex items-center justify-between">
                {item.q}
                <span className="text-muted group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="text-sm text-white/50 mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 flex items-center gap-3">
          <Mail size={18} className="text-accent-2 shrink-0" />
          <div className="text-sm text-white/60">Vẫn cần hỗ trợ? Kênh liên hệ trực tiếp đang được chuẩn bị -- quay lại sau nhé.</div>
        </div>
      </div>
    </DashboardShell>
  );
}
