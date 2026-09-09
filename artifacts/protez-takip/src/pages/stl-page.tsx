import React, { useState, useEffect } from "react";
import { Upload, Download, Trash2, FileBox, RefreshCw } from "lucide-react";

interface StlFile {
  key: string;
  size: number;
  lastModified: string;
}

export default function StlPage() {
  const [files, setFiles] = useState<StlFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/stl`);
      if (!res.ok) throw new Error("Dosyalar alınamadı");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
      alert("STL dosyaları listelenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
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
      alert("STL dosyası başarıyla yüklendi!");
      fetchFiles();
    } catch (err) {
      console.error(err);
      alert("Dosya yüklenirken hata oluştu.");
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

      alert("Dosya silindi.");
      fetchFiles();
    } catch (err) {
      console.error(err);
      alert("Dosya silinirken hata oluştu.");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <FileBox className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">STL Dosya Paylaşım Sistemi</h1>
        </div>
        <button
          onClick={fetchFiles}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Yenile</span>
        </button>
      </div>

      {/* Yükleme Formu */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Yeni STL Dosyası Yükle</h2>
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
          <input
            type="file"
            accept=".stl"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
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
    </div>
  );
}