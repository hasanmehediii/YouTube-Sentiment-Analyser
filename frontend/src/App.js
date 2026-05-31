import { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";

const API = "http://localhost:9000/api";
const COLORS = { positive: "#22c55e", negative: "#ef4444", neutral: "#f59e0b" };

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("analyse");

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const res = await axios.get(`${API}/history`);
    setHistory(res.data || []);
  };

  const analyse = async () => {
    if (!url) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await axios.post(`${API}/analyse`, { url });
      setResult(res.data);
      fetchHistory();
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong");
    }
    setLoading(false);
  };

  const deleteRecord = async (id) => {
    await axios.delete(`${API}/history/${id}`);
    fetchHistory();
  };

  const pieData = result ? [
    { name: "Positive", value: result.summary.positive },
    { name: "Negative", value: result.summary.negative },
    { name: "Neutral",  value: result.summary.neutral },
  ] : [];

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ color: "#1e293b" }}>🎬 YouTube Sentiment Analyser</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {["analyse", "history"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t ? "#6366f1" : "#e2e8f0", color: tab === t ? "#fff" : "#1e293b" }}>
            {t === "analyse" ? "🔍 Analyse" : "📜 History"}
          </button>
        ))}
      </div>

      {tab === "analyse" && (
        <div>
          {/* Input */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 16 }} />
            <button onClick={analyse} disabled={loading}
              style={{ padding: "10px 24px", background: "#6366f1", color: "#fff", border: "none",
                borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
              {loading ? "Analysing..." : "Analyse"}
            </button>
          </div>

          {error && <div style={{ color: "#ef4444", marginBottom: 16 }}>❌ {error}</div>}

          {result && (
            <div>
              <h2>📊 Results for: {result.title || result.videoId}</h2>
              <p style={{ color: "#64748b" }}>Total comments analysed: {result.summary.total}</p>

              {/* Charts */}
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 32 }}>
                <div>
                  <h3>Overall Sentiment</h3>
                  <PieChart width={300} height={250}>
                    <Pie data={pieData} cx={140} cy={110} outerRadius={90} dataKey="value" label>
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase()]} />
                      ))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </div>
                <div>
                  <h3>Comment Count</h3>
                  <BarChart width={300} height={250} data={pieData}>
                    <XAxis dataKey="name" /><YAxis /><Tooltip />
                    <Bar dataKey="value">
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase()]} />
                      ))}
                    </Bar>
                  </BarChart>
                </div>
              </div>

              {/* Comments Table */}
              <h3>💬 Comment Breakdown</h3>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: 10, textAlign: "left" }}>Comment</th>
                      <th style={{ padding: 10 }}>Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 10 }}>{r.comment}</td>
                        <td style={{ padding: 10, textAlign: "center" }}>
                          <span style={{ background: COLORS[r.sentiment], color: "#fff",
                            padding: "2px 10px", borderRadius: 12, fontSize: 13 }}>
                            {r.sentiment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          <h2>📜 Past Analyses</h2>
          {history.length === 0 && <p style={{ color: "#94a3b8" }}>No analyses yet.</p>}
          {history.map(h => (
            <div key={h.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10,
              padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{h.title || h.videoId}</div>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                  ✅ {h.summary.positive} · ❌ {h.summary.negative} · 😐 {h.summary.neutral}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  {new Date(h.createdAt).toLocaleString()}
                </div>
              </div>
              <button onClick={() => deleteRecord(h.id)}
                style={{ background: "#fee2e2", color: "#ef4444", border: "none",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}