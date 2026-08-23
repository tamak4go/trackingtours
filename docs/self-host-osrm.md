# Tự host OSRM (routing server)

App mặc định dùng OSRM demo server công khai (`https://router.project-osrm.org`) để tính quãng đường theo đường thực tế. Server này **không có SLA** — có thể chậm, rate-limit, hoặc downtime bất kỳ lúc nào, không phù hợp nếu app có lượng người dùng thật đều đặn.

Việc này **cần một server/VPS riêng để chạy Docker** — không thể làm chỉ bằng thay đổi code, và không nằm trong Vercel (Vercel không chạy được container dài hạn kiểu này). Bạn cần tự chọn nơi host (Fly.io, Railway, DigitalOcean, VPS riêng, ...) trước khi làm theo hướng dẫn dưới.

## Bước 1: Tải dữ liệu OSM cho Việt Nam

```bash
wget https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
```

## Bước 2: Xử lý dữ liệu (chạy 1 lần, cần vài GB RAM tạm thời)

```bash
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/vietnam-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/vietnam-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/vietnam-latest.osrm
```

## Bước 3: Chạy server

`docker-compose.yml`:

```yaml
services:
  osrm:
    image: ghcr.io/project-osrm/osrm-backend
    command: osrm-routed --algorithm mld /data/vietnam-latest.osrm
    volumes:
      - ./data:/data
    ports:
      - "5000:5000"
    restart: unless-stopped
```

```bash
docker compose up -d
```

Nên đặt sau một reverse proxy có HTTPS (Caddy/nginx/Cloudflare Tunnel) vì trình duyệt sẽ gọi thẳng từ client, cần domain HTTPS hợp lệ (không gọi được `http://` từ trang `https://`).

## Bước 4: Trỏ app vào server mới

Thêm vào `.env.local` (hoặc Environment Variables trên Vercel):

```
NEXT_PUBLIC_OSRM_BASE_URL=https://osrm.yourdomain.com
```

Không cần sửa code — `src/lib/geo.ts` đã đọc biến này, fallback về server demo công khai nếu bỏ trống.

## Cập nhật dữ liệu OSM định kỳ

Bản đồ đường xá thay đổi theo thời gian — nên lặp lại bước 1–2 mỗi vài tháng (tải file `.osm.pbf` mới, extract/partition/customize lại) để routing không bị lệch với đường thực tế.
