import { Router } from "express";
import stlRouter from "./stl.js";
import healthRouter from "./health.js";
import prosthesisRouter from "./prosthesis.js";

const router = Router();

// SaaS Çoklu Laboratuvar (Tenant) listesi geçici belleği
let labsList = [
  { id: 1, name: "Merkez Laboratuvar", email: "lab@ornek.com", password: "123" }
];

// Diğer rotaların yanı sıra stl router'ı ekliyoruz
router.use("/stl", stlRouter);
router.use(healthRouter);
router.use(prosthesisRouter);

// Super Admin: Kayıtlı laboratuvarları listele
router.get("/admin/labs", (req, res) => {
  res.json(labsList);
});

// Super Admin: Yeni laboratuvar oluştur
router.post("/admin/labs", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  // Aynı e-posta ile kayıt var mı kontrolü
  const exists = labsList.find(l => l.email === email);
  if (exists) {
    return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir laboratuvar kayıtlı." });
  }

  const newLab = { id: Date.now(), name, email, password };
  labsList.push(newLab);
  res.json({ success: true, lab: newLab });
});

// Laboratuvar Giriş (Login) Ucu
router.post("/auth/lab-login", (req, res) => {
  const { email, password } = req.body;
  const lab = labsList.find(l => l.email === email && l.password === password);

  if (!lab) {
    return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
  }

  res.json({
    success: true,
    lab: { id: lab.id, name: lab.name, email: lab.email },
    token: "saas-lab-token-" + lab.id
  });
});

export default router;