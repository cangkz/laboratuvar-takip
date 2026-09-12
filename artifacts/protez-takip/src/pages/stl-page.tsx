import React, { useState, useEffect } from "react";
import { Upload, Download, Trash2, FileBox, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, HardDrive, UserPlus, X, Building2 } from "lucide-react";
import { Link } from "wouter";

interface StlFile {
  key: string;
  size: number;
  lastModified: string;
}

interface ExternalLab {
  id: number;
  name: string;
  email: string;
}

interface ExternalStlJob {
  id: number;
  externalLabId: number;
  patientName: string;
  fileName: string;
  fileUrl: string;
  status: string;
  downloadedAt: string | null;
  createdAt: string;
}

export default function StlPage() {
  const [files, setFiles] = useState<StlFile[]>([]);
  const [downloads, setDownloads] = useState<{ name: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // B2B Lab-to-Lab Modalı ve Verileri İçin State'ler
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [externalLabs, setExternalLabs] = useState<ExternalLab[]>([]);
  const [externalStls, setExternalStls] = useState<ExternalStlJob[]>([]);
  const [labName, setLabName] = useState("");
  const [labEmail, setLabEmail] = useState("");
  const [labPassword, setLabPassword] = useState("");
  const [submittingLab, setSubmittingLab] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/stl`);
      if (!res.ok) throw new Error("Dosyalar alınamadı");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
      showToast("STL dosyaları listelenirken hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Dış Lab ve STL Takip Verilerini Çek
  const fetchExternalData = async () => {
    try {
      const labsRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/external-labs`);
      if (labsRes.ok) {
        const labsData = await labsRes.json();
        setExternalLabs(labsData);
      }

      const stlsRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/external-stls`);
      if (stlsRes.ok) {
        const stlsData = await stlsRes.json();
        setExternalStls(stlsData);
      }
    } catch (err) {
      console.error("Dış lab verileri alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchExternalData();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setUploading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/stl`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Yükleme başarısız");

      setSelectedFile(null);
      showToast(`"${selectedFile.name}" başarıyla yüklendi!`, "success");
      fetchFiles();
    } catch (err) {
      console.error(err);
      showToast("Dosya yüklenirken hata oluştu.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm("Bu dosyayı silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/stl/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Silme başarısız");

      showToast("Dosya başarıyla silindi.", "success");
      fetchFiles();
    } catch (err) {
      console.error(err);
      showToast("Dosya silinirken hata oluştu.", "error");
    }
  };

  const handleDownloadClick = (fileName: string) => {
    const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
    setDownloads(prev => [{ name: fileName, time: timeStr }, ...prev.filter(d => d.name !== fileName)]);
    showToast(`"${fileName}" indirilmek üzere başlatıldı.`, "success");
  };

  // Yeni Dış Lab Ekleme Fonksiyonu
  const handleAddExternalLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName || !labEmail || !labPassword) return;

    try {
      setSubmittingLab(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/external-labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: labName, email: labEmail, password: labPassword }),
      });
      const data = await res.json();

      if (data.success) {
        showToast("Dış laboratuvar başarıyla eklendi!", "success");
        setLabName("");
        setLabEmail("");
        setLabPassword("");
        fetchExternalData();
      } else {
        showToast(data.error || "Laboratuvar eklenemedi.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Sunucu hatası oluştu.", "error");
    } finally {
      setSubmittingLab(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 relative">
      {/* Toast Bildirim Alanı */}
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

      {/* Üst Kısım: Ana Sayfa Dönüş Butonu, Başlık ve Sağ Üst "STL Ortağı Ekle" Butonu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition flex items-center gap-1.5 text-xs font-bold" title="Ana Sayfaya Dön">
            <ArrowLeft className="w-4 h-4" />
            <span>Ana Sayfa</span>
          </Link>
          <div className="h-6 w-px bg-gray-300 hidden sm:block" />
          <div className="flex items-center space-x-3">
            <FileBox className="w-8 h-8 text-[hsl(var(--primary))]" />
            <h1 className="text-2xl font-bold text-gray-900">STL Dosya Paylaşım Sistemi</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* SAĞ ÜST KÖŞE: STL ORTAĞI EKLE BUTONU */}
          <button
            onClick={() => { setIsModalOpen(true); fetchExternalData(); }}
            className="flex items-center space-x-2 px-4 py-2 bg-[hsl(var(--primary))] hover:opacity-90 text-white font-medium rounded-lg shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>STL Ortağı Ekle</span>
          </button>

          <button
            onClick={fetchFiles}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Yükleme Formu */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Yeni STL Dosyası Yükle</h2>
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[hsl(var(--secondary))] file:text-[hsl(var(--primary))] hover:file:opacity-80"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2 bg-[hsl(var(--primary))] hover:opacity-90 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Yükleniyor..." : "Yükle"}</span>
          </button>
        </form>
      </div>

      {/* Dosya Listesi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Yüklenen STL Dosyaları</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Henüz yüklenmiş STL dosyası bulunmuyor.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div key={file.key} className="p-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{file.key}</p>
                  <p className="text-xs text-gray-500">
                    Boyut: {(file.size / (1024 * 1024)).toFixed(2)} MB • Tarih: {new Date(file.lastModified).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/api/stl/${encodeURIComponent(file.key)}/download`}
                    onClick={() => handleDownloadClick(file.key)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="İndir"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => handleDelete(file.key)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Sil"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* İndirilen Dosyalar Bölümü */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-semibold text-gray-800">İndirilen Dosyalarım</h2>
          </div>
          {downloads.length > 0 && (
            <button 
              onClick={() => setDownloads([])}
              className="text-xs text-red-600 hover:underline font-medium"
            >
              Geçmişi Temizle
            </button>
          )}
        </div>
        {downloads.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-xs">Bu oturumda henüz bir dosya indirdiğiniz görünmüyor.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {downloads.map((item, index) => (
              <div key={index} className="px-6 py-3 flex items-center justify-between text-sm hover:bg-gray-50 transition">
                <span className="font-medium text-gray-700">{item.name}</span>
                <span className="text-xs text-gray-400">İndirildi: {item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STL ORTAĞI EKLE VE YÖNETİM MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Başlık */}
            <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                <h3 className="text-lg font-bold text-gray-800">Dış Laboratuvar & STL Ortak Yönetimi</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal İçerik */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Yeni Dış Lab Ekleme Formu */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Yeni Dış Laboratuvar Hesabı Oluştur</h4>
                <form onSubmit={handleAddExternalLab} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Lab Adı"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="p-2 border rounded-lg text-sm bg-white"
                    required
                  />
                  <input
                    type="email"
                    placeholder="E-posta adresi"
                    value={labEmail}
                    onChange={(e) => setLabEmail(e.target.value)}
                    className="p-2 border rounded-lg text-sm bg-white"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={labPassword}
                    onChange={(e) => setLabPassword(e.target.value)}
                    className="p-2 border rounded-lg text-sm bg-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingLab}
                    className="sm:col-span-3 bg-[hsl(var(--primary))] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:bg-gray-300"
                  >
                    {submittingLab ? "Ekleniyor..." : "Laboratuvarı Kaydet"}
                  </button>
                </form>
              </div>

              {/* Kayıtlı Dış Laboratuvarlar Listesi */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Kayıtlı Dış Laboratuvarlar ({externalLabs.length})</h4>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b text-gray-600">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Lab Adı</th>
                        <th className="p-3">E-posta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {externalLabs.map((lab) => (
                        <tr key={lab.id} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-500">{lab.id}</td>
                          <td className="p-3 font-medium text-gray-800">{lab.name}</td>
                          <td className="p-3 text-gray-600">{lab.email}</td>
                        </tr>
                      ))}
                      {externalLabs.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-400 text-xs">Henüz kayıtlı dış laboratuvar yok.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dış Lablardan Gelen STL İşleri ve İndirilme Zaman Damgası (downloadedAt) Takibi */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Gelen STL Gönderimleri ve İndirme Durumu</h4>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b text-gray-600">
                      <tr>
                        <th className="p-3">Hasta Adı</th>
                        <th className="p-3">Dosya</th>
                        <th className="p-3">Durum</th>
                        <th className="p-3">İndirilme Zamanı (downloadedAt)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {externalStls.map((stl) => (
                        <tr key={stl.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-800">{stl.patientName}</td>
                          <td className="p-3 text-blue-600 underline text-xs">
                            <a href={stl.fileUrl} target="_blank" rel="noreferrer">{stl.fileName}</a>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              stl.status === 'İndirildi' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {stl.status}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-500">
                            {stl.downloadedAt ? new Date(stl.downloadedAt).toLocaleString('tr-TR') : 'Henüz indirilmedi'}
                          </td>
                        </tr>
                      ))}
                      {externalStls.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400 text-xs">Henüz dış laboratuvarlardan gelen STL kaydı bulunmuyor.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Kapat Butonu */}
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}