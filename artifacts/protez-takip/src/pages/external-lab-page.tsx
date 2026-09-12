import React, { useState, useEffect } from "react";
import { Upload, FileBox, RefreshCw, CheckCircle2, AlertCircle, Clock, Send, LogOut } from "lucide-react";
import { useLocation } from "wouter";

interface ExternalStlJob {
  id: number;
  patientName: string;
  prosthesisType: string;
  fileName: string;
  status: string;
  downloadedAt: string | null;
  createdAt: string;
}

export default function ExternalLabPage() {
  const [, setLocation] = useLocation();
  const [labInfo, setLabInfo] = useState<{ id: number; name: string; email: string } | null>(null);
  const [jobs, setJobs] = useState<ExternalStlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [prosthesisType, setProsthesisType] = useState("Zirkon Kron");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getToken = () => localStorage.getItem("externalLabToken");

  useEffect(() => {
    const token = getToken();
    const info = localStorage.getItem("externalLabInfo");
    if (!token || !info) {
      setLocation("/external-lab-login");
      return;
    }
    setLabInfo(JSON.parse(info));
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/external-lab/stls`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error("İşler alınamadı");
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
      showToast("Geçmiş işler yüklenirken hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("externalLabToken");
    localStorage.removeItem("externalLabInfo");
    setLocation("/external-lab-login");
  };

  const handleSendJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !selectedFile) {
      showToast("Lütfen hasta adı girin ve bir STL dosyası seçin.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("patientName", patientName);
    formData.append("prosthesisType", prosthesisType);

    try {
      setSubmitting(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/external-lab/stls`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error("İş gönderilemedi");

      setPatientName("");
      setSelectedFile(null);
      showToast("İş ve STL dosyası merkez laboratuvara başarıyla gönderildi!", "success");
      fetchJobs();
    } catch (err) {
      console.error(err);
      showToast("İş gönderilirken bir hata oluştu.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-bounce ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={18} className="text-green-600" /> : <AlertCircle size={18} className="text-red-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Send className="w-8 h-8 text-[hsl(var(--primary))]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab-to-Lab İş Gönderme Paneli</h1>
            {labInfo && <p className="text-xs text-gray-500">{labInfo.name} olarak giriş yapıldı</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Yenile</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-red-600 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Çıkış</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Yeni İş ve STL Dosyası Gönder</h2>
        <form onSubmit={handleSendJob} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">HASTA ADI SOYADI</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PROTEZ TÜRÜ</label>
              <select
                value={prosthesisType}
                onChange={(e) => setProsthesisType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
              >
                <option value="Zirkon Kron">Zirkon Kron</option>
                <option value="E-Max">E-Max</option>
                <option value="İmplant Üstü Protez">İmplant Üstü Protez</option>
                <option value="Hareketli Protez">Hareketli Protez</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">STL DOSYASI SEÇ</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[hsl(var(--secondary))] file:text-[hsl(var(--primary))] hover:file:opacity-80"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2 bg-[hsl(var(--primary))] hover:opacity-90 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <Upload className="w-4 h-4" />
            <span>{submitting ? "Gönderiliyor..." : "Merkez Lab'a Gönder"}</span>
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Gönderilen Geçmiş İşler ve İndirme Durumları</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Henüz gönderilmiş bir iş bulunmuyor.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <div key={job.id} className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{job.patientName} — {job.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Gönderim Tarihi: {new Date(job.createdAt).toLocaleString("tr-TR")} • {job.prosthesisType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {job.downloadedAt ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      İndirildi: {new Date(job.downloadedAt).toLocaleString("tr-TR")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                      <Clock className="w-3.5 h-3.5" />
                      Merkez Tarafından Bekleniyor
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}