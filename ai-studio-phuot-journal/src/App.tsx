import { useState } from 'react';
import type { TripInput, JournalResult } from './types';
import { generateJournal } from './services/geminiService';
import './App.css';

const defaultInput: TripInput = {
  title: '',
  route: '',
  days: 3,
  highlights: '',
  tone: 'hào hứng',
};

function App() {
  const [input, setInput] = useState<TripInput>(defaultInput);
  const [result, setResult] = useState<JournalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = input.title.trim() && input.route.trim() && input.highlights.trim() && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const journal = await generateJournal(input);
      setResult(journal);
    } catch (err) {
      console.error(err);
      setError('Không tạo được nhật ký. Kiểm tra lại API key hoặc thử lại sau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">AI Riser Vietnam 2026 · #BuildwithGoogleAI</p>
        <h1>Nhật Ký Phượt AI</h1>
        <p className="subtitle">
          Kể lại chuyến đi thô ráp của bạn — Gemini biến nó thành nhật ký hành trình, gợi ý lịch trình
          và caption sẵn sàng đăng mạng xã hội.
        </p>
      </header>

      <main className="layout">
        <form className="card form" onSubmit={handleSubmit}>
          <label>
            Tên chuyến đi
            <input
              value={input.title}
              onChange={(e) => setInput({ ...input, title: e.target.value })}
              placeholder="VD: Hà Giang mùa hoa tam giác mạch"
            />
          </label>

          <label>
            Cung đường / điểm dừng
            <input
              value={input.route}
              onChange={(e) => setInput({ ...input, route: e.target.value })}
              placeholder="VD: Hà Nội → Hà Giang → Đồng Văn → Mèo Vạc"
            />
          </label>

          <label>
            Số ngày
            <input
              type="number"
              min={1}
              max={30}
              value={input.days}
              onChange={(e) => setInput({ ...input, days: Number(e.target.value) })}
            />
          </label>

          <label>
            Giọng văn
            <select
              value={input.tone}
              onChange={(e) => setInput({ ...input, tone: e.target.value as TripInput['tone'] })}
            >
              <option value="hào hứng">Hào hứng</option>
              <option value="hoài niệm">Hoài niệm</option>
              <option value="hài hước">Hài hước</option>
            </select>
          </label>

          <label>
            Khoảnh khắc / ghi chú thô
            <textarea
              rows={5}
              value={input.highlights}
              onChange={(e) => setInput({ ...input, highlights: e.target.value })}
              placeholder="VD: Thủng săm lúc nửa đêm ở đèo Mã Pí Lèng, gặp gia đình người Mông mời cơm, ngắm bình minh trên cột cờ Lũng Cú..."
            />
          </label>

          <button type="submit" disabled={!canSubmit}>
            {loading ? 'Đang viết nhật ký...' : 'Tạo nhật ký hành trình'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="card result">
          {!result && !loading && <p className="placeholder">Kết quả nhật ký sẽ hiện ở đây.</p>}
          {loading && <p className="placeholder">Gemini đang ghép lại hành trình của bạn...</p>}
          {result && (
            <>
              <h2>{input.title}</h2>
              <p className="story">{result.story}</p>

              <h3>Khoảnh khắc nổi bật</h3>
              <ul>
                {result.highlightMoments.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>

              <h3>Gợi ý cho người đi sau</h3>
              <ul>
                {result.itineraryTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>

              <h3>Caption mạng xã hội</h3>
              <p className="caption">{result.socialCaption}</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
