import React, { useState } from "react";
import { useLocation } from "wouter";
import { Building2, LogIn } from "lucide-react";

export default function ExternalLabLoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth/external-lab-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı.");
        return;
      }
      localStorage.setItem("externalLabToken", data.token);
      localStorage.setItem("externalLabInfo", JSON.stringify(data.lab));
      setLocation("/external-lab");
    } catch (err) {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-[hsl(var(--primary))] p-7 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Building2 size={26} />
          </div>
          <h1 className="text-xl font-extrabold">Dış Laboratuvar Girişi</h1>
          <p className="mt-1 text-xs text-white/70">STL dosyalarınızı göndermek için giriş yapın</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg p-3">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">E-posta Adresi</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[hsl(var(--primary))] hover:opacity-90 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <LogIn size={16} />
            <span>{loading ? "Giriş yapılıyor..." : "Giriş Yap"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}