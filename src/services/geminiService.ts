import { ScheduleItem } from "../types";

export const getSmartInsights = async (items: ScheduleItem[]) => {
  if (items.length === 0) return "Belum ada jadwal untuk dianalisis. Cobalah tambahkan beberapa kegiatan!";

  try {
    const response = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    
    if (!response.ok) throw new Error("Server error");
    
    const data = await response.json();
    return data.insight;
  } catch (error) {
    console.error("Fetch Error:", error);
    return "Maaf, gagal mendapatkan saran pintar saat ini.";
  }
};
