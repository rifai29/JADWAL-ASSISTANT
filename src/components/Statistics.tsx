import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ScheduleItem } from '../types';
import { useMemo } from 'react';

interface StatsProps {
  items: ScheduleItem[];
}

export default function Statistics({ items }: StatsProps) {
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [items]);

  const priorityData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    items.forEach(item => {
      counts[item.priority] += 1;
    });
    return [
      { name: 'Rendah', value: counts.Low, color: '#22c55e' },
      { name: 'Sedang', value: counts.Medium, color: '#eab308' },
      { name: 'Tinggi', value: counts.High, color: '#ef4444' },
    ];
  }, [items]);

  const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#71717a'];

  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-400 bg-zinc-50 rounded-[2.5rem] border-2 border-dashed border-zinc-200">
        <p className="font-bold text-sm uppercase tracking-widest">Belum ada data untuk dianalisis.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8" id="stats-container">
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-zinc-200">
        <h4 className="text-xs font-black text-zinc-400 mb-6 uppercase tracking-[0.2em] font-display">Alokasi Kategori</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-zinc-200">
        <h4 className="text-xs font-black text-zinc-400 mb-6 uppercase tracking-[0.2em] font-display">Tingkat Prioritas</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priorityData} barSize={40}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <Tooltip 
                cursor={{ fill: '#f4f4f5' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
