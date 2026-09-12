import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
 
export interface ExternalLabAuthedRequest extends Request {
  externalLab?: { id: number; name: string; email: string };
}
 
const JWT_SECRET = process.env.JWT_SECRET;
 
export function signExternalLabToken(payload: { id: number; name: string; email: string }): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET ortam değişkeni tanımlı değil.");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
 
export function requireExternalLabAuth(
  req: ExternalLabAuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Yetkilendirme başlığı eksik." });
    return;
  }
 
  const token = authHeader.slice("Bearer ".length);
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Sunucu yapılandırma hatası." });
    return;
  }
 
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; name: string; email: string };
    req.externalLab = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum." });
  }
}
 




























