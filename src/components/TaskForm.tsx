import { X, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import React, { useState } from 'react';
import { ScheduleItem, Priority, Category, SubTask, Status } from '../types';
import { format } from 'date-fns';

interface TaskFormProps {
  onClose: () => void;
  onSave: (item: Partial<ScheduleItem>) => void;
  initialData?: ScheduleItem;
  selectedDate?: Date;
}

export default function TaskForm({ onClose, onSave, initialData, selectedDate }: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')));
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00');
  const [priority, setPriority] = useState<Priority>(initialData?.priority || 'Medium');
  const [category, setCategory] = useState<Category>(initialData?.category || 'Personal');
  const [status, setStatus] = useState<Status>(initialData?.status || 'Pending');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [subtasks, setSubtasks] = useState<SubTask[]>(initialData?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      date,
      startTime,
      endTime,
      priority,
      category,
      status,
      subtasks,
      notes,
    });
  };

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newTask: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSubtaskTitle,
      isCompleted: false,
    };
    setSubtasks([...subtasks, newTask]);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, isCompleted: !st.isCompleted } : st));
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200" id="task-form-container">
        <div className="px-5 py-4 sm:px-8 sm:py-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 font-display">{initialData ? 'Edit Jadwal' : 'Buat Jadwal Baru'}</h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Konfigurasi Agenda Terperinci</p>
          </div>
          <button onClick={onClose} className="p-2.5 sm:p-3 hover:bg-zinc-200 rounded-2xl transition-all" id="close-form-btn">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 md:col-span-2">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Judul Kegiatan</label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Deep Work: Desain Sistem"
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all font-bold text-zinc-900"
                id="task-title-input"
              />
            </div>

            <div className="md:col-span-2 space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Deskripsi & Catatan</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fokus pada arsitektur database dan UI KIT utama..."
                rows={3}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all resize-none text-sm font-medium text-zinc-600"
                id="task-desc-input"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tanggal</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all font-bold text-zinc-900"
                id="task-date-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Mulai</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all font-bold text-zinc-900"
                  id="task-start-time"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Selesai</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all font-bold text-zinc-900"
                  id="task-end-time"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Prioritas</label>
              <div className="flex space-x-2">
                {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${
                      priority === p 
                        ? p === 'High' ? 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-200' :
                          p === 'Medium' ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' :
                          'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200'
                        : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100'
                    }`}
                    id={`priority-${p}`}
                  >
                    {p === 'Low' ? 'RINGAN' : p === 'Medium' ? 'PENTING' : 'MENDESAK'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none font-bold text-zinc-900"
                id="task-category"
              >
                <option value="Work">Pekerjaan</option>
                <option value="Personal">Pribadi</option>
                <option value="Health">Kesehatan</option>
                <option value="Education">Pendidikan</option>
                <option value="Other">Lainnya</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-4">
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Daftar Periksa (Opsi)</label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Tambahkan sub-tugas..."
                  className="flex-1 px-5 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  id="subtask-input"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  className="p-3 bg-zinc-900 text-white rounded-2xl hover:bg-black transition-all shadow-xl shadow-zinc-200"
                  id="add-subtask-btn"
                >
                  <Plus size={24} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {subtasks.map((st) => (
                  <div key={st.id} className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-2xl group transition-all hover:bg-white hover:border-zinc-300">
                    <div className="flex items-center space-x-3">
                      <button type="button" onClick={() => toggleSubtask(st.id)} className="transition-transform active:scale-90">
                        {st.isCompleted ? <CheckCircle2 size={20} className="text-emerald-500" /> : <div className="w-5 h-5 border-2 border-zinc-300 rounded-full" />}
                      </button>
                      <span className={`text-xs font-bold ${st.isCompleted ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{st.title}</span>
                    </div>
                    <button type="button" onClick={() => removeSubtask(st.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-6 rounded-2xl border border-zinc-200 font-black text-xs uppercase tracking-widest text-zinc-400 hover:bg-zinc-50 transition-all"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="flex-[2] py-4 px-6 rounded-2xl bg-zinc-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black shadow-2xl shadow-zinc-300 transition-all transform hover:-translate-y-1 active:translate-y-0"
              id="save-task-btn"
            >
              SIMPAN JADWAL PRO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
