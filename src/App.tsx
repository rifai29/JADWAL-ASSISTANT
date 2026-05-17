import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, PieChart as StatsIcon, CheckSquare, Settings, LogOut, Bell, Search, Sparkles, Filter, Edit2, Trash2, CheckCircle2, LogIn } from 'lucide-react';
import { format, isSameDay, parseISO, compareAsc } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

import { ScheduleItem, Status } from './types';
import Calendar from './components/Calendar';
import TaskForm from './components/TaskForm';
import Statistics from './components/Statistics';
import { getSmartInsights } from './services/geminiService';
import { auth, db, loginWithGoogle, logout } from './lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | undefined>(undefined);
  const [view, setView] = useState<'calendar' | 'stats' | 'list'>('calendar');
  const [smartInsight, setSmartInsight] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const q = query(collection(db, 'schedules'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduleItem[];
      setItems(newItems);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    return () => unsubscribe();
  }, [user]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return compareAsc(dateA, dateB);
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedItems, searchTerm]);

  const dayItems = useMemo(() => {
    return sortedItems.filter(item => isSameDay(parseISO(item.date), selectedDate));
  }, [sortedItems, selectedDate]);

  const saveItem = async (itemData: Partial<ScheduleItem>) => {
    if (!user) return;
    
    try {
      if (editingItem) {
        const docRef = doc(db, 'schedules', editingItem.id);
        await updateDoc(docRef, {
          ...itemData,
          updatedAt: Date.now()
        });
      } else {
        const newItem = {
          ...itemData,
          userId: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          subtasks: itemData.subtasks || [],
          notes: itemData.notes || '',
          priority: itemData.priority || 'Medium',
          category: itemData.category || 'Personal',
          status: itemData.status || 'Pending',
        };
        await addDoc(collection(db, 'schedules'), newItem);
      }
      setIsFormOpen(false);
      setEditingItem(undefined);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
      }
    }
  };

  const toggleStatus = async (id: string) => {
    if (!user) return;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const nextStatus: Status = item.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await updateDoc(doc(db, 'schedules', id), {
        status: nextStatus,
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `schedules/${id}`);
    }
  };

  const handleGetInsight = async () => {
    setIsAnalyzing(true);
    const insight = await getSmartInsights(items);
    setSmartInsight(insight);
    setIsAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Menyiapkan JadwalPro...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex bg-white font-sans">
        <div className="flex-1 flex flex-col items-center justify-center p-12 lg:p-24">
          <div className="w-full max-w-md space-y-8">
            <div className="flex items-center space-x-3 mb-12 justify-center lg:justify-start">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
                <CalendarIcon size={28} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-blue-900 font-display">JadwalPro</h1>
            </div>
            
            <div className="space-y-4 text-center lg:text-left">
              <h2 className="text-4xl font-black text-gray-900 leading-tight font-display">
                Kelola Waktumu Dengan <span className="text-blue-600 underline decoration-blue-200 underline-offset-8">Lebih Pintar.</span>
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Atur jadwal harian, pantau produktivitas, dan dapatkan saran cerdas dari AI untuk hari yang lebih efisien.
              </p>
            </div>

            <div className="pt-8">
              <button 
                onClick={loginWithGoogle}
                className="w-full py-4 px-6 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center space-x-4 hover:bg-black transition-all shadow-xl shadow-gray-200 transform hover:-translate-y-1 active:translate-y-0"
                id="login-google-btn"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                <span>Lanjutkan dengan Google</span>
              </button>
            </div>

            <div className="pt-12 text-center text-xs text-gray-400">
              Dengan masuk, Anda setuju dengan ketentuan layanan kami.
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-1 bg-blue-600 p-24 items-center justify-center relative overflow-hidden">
          <div className="relative z-10 w-full max-w-lg aspect-square bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-8 flex flex-col justify-end">
            <div className="space-y-6">
              <div className="w-16 h-1 bg-white/40 rounded-full"></div>
              <p className="text-4xl font-bold text-white font-display">"Penjadwalan yang terperinci adalah langkah awal kesuksesan."</p>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-400"></div>
                <div>
                  <p className="font-bold text-white">Tim JadwalPro</p>
                  <p className="text-sm text-white/60 text-indigo-100">Product Team</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400 rounded-full -mr-48 -mt-48 blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500 rounded-full -ml-48 -mb-48 blur-3xl opacity-50"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-100 font-sans text-zinc-900" id="main-app">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-zinc-200 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <CalendarIcon size={22} />
            </div>
            <h1 className="text-lg font-bold tracking-tighter text-zinc-900 hidden lg:block font-display">Jadwal<span className="text-blue-600">PRO</span></h1>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'calendar', icon: CalendarIcon, label: 'Kalender' },
              { id: 'list', icon: CheckSquare, label: 'Tugas' },
              { id: 'stats', icon: StatsIcon, label: 'Statistik' }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setView(item.id as any)}
                className={`w-full flex items-center lg:space-x-3 p-3 rounded-2xl transition-all ${view === item.id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}
                id={`view-${item.id}-btn`}
              >
                <item.icon size={22} className={view === item.id ? 'text-blue-500' : ''} />
                <span className="hidden lg:block font-semibold">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-zinc-100">
          <button 
            onClick={logout}
            className="w-full flex items-center lg:space-x-3 p-3 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={22} />
            <span className="hidden lg:block font-bold">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center bg-zinc-100 px-4 py-2 rounded-2xl border border-zinc-200 w-80 lg:w-96 transition-all focus-within:w-[420px] focus-within:shadow-sm">
            <Search size={16} className="text-zinc-400 mr-2" />
            <input 
              type="text" 
              placeholder="Cari agenda..." 
              className="bg-transparent border-none outline-none text-xs w-full font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="search-input"
            />
          </div>

          <div className="flex items-center space-x-4 lg:space-x-6">
            <div className="text-right hidden lg:block">
              <p className="text-xs font-bold">{format(new Date(), 'EEEE, d MMMM', { locale: id })}</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Minggu ke-{format(new Date(), 'w')}</p>
            </div>
            <div className="flex items-center space-x-3 pl-4 lg:pl-6 border-l border-zinc-200">
              <div className="text-right">
                <p className="text-[11px] font-black text-zinc-900 leading-none">{user.displayName?.split(' ')[0]}</p>
                <p className="text-[9px] text-zinc-400 font-bold mt-0.5">Pro Account</p>
              </div>
              <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
            </div>
          </div>
        </header>

        {/* Bento Grid Area */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Action Bar (Top Full Width) */}
            <div className="md:col-span-3 flex items-center justify-between mb-1">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 font-display">
                  {view === 'calendar' ? 'Alur Waktu' : view === 'stats' ? 'Analisis' : 'Semua Tugas'}
                </h2>
                <p className="text-zinc-500 font-medium uppercase text-[9px] tracking-widest mt-0.5">Manajemen Jadwal Terperinci • v4.2</p>
              </div>
              <button 
                onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-2 hover:bg-black transition-all shadow-xl shadow-zinc-200"
                id="add-task-header-btn"
              >
                <Plus size={16} />
                <span>TAMBAH JADWAL</span>
              </button>
            </div>

            {/* Large Content Card (Bento Style) */}
            <div className="md:col-span-2 space-y-6">
              {/* AI Insight (Bento Block) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-blue-600 rounded-[2rem] p-7 text-white relative overflow-hidden shadow-2xl shadow-blue-200"
              >
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                      <Sparkles size={18} className="text-yellow-300" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">AI PRO INSIGHT</span>
                  </div>
                  <p className="text-lg font-bold leading-snug max-w-2xl font-display">
                    {smartInsight || "Klik tombol analisis untuk mendapatkan saran koordinasi waktu paling optimal hari ini."}
                  </p>
                  <button 
                    onClick={handleGetInsight}
                    disabled={isAnalyzing}
                    className="px-5 py-2.5 bg-white text-blue-600 rounded-xl font-black text-[11px] hover:bg-zinc-100 transition-all flex items-center space-x-2"
                  >
                    <span>{isAnalyzing ? 'MENGANALISIS...' : 'DAPATKAN ANALISIS'}</span>
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
              </motion.div>

              {/* Main View (Bento Block) */}
              <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm p-6 lg:p-7 min-h-[500px]">
                {view === 'calendar' ? (
                  <Calendar 
                    onDateSelect={setSelectedDate} 
                    selectedDate={selectedDate} 
                    items={items} 
                  />
                ) : view === 'stats' ? (
                  <Statistics items={items} />
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-lg font-display flex items-center gap-2">
                         <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                         Daftar Agenda
                      </h3>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-3 py-1 rounded-full border border-zinc-100">
                        {filteredItems.length} ITEM DITEMUKAN
                      </div>
                    </div>
                    <div className="space-y-3">
                      {filteredItems.map(item => (
                        <div key={item.id} className="group flex items-center justify-between p-4 bg-zinc-50 hover:bg-white border border-zinc-100 hover:border-zinc-300 rounded-3xl transition-all hover:shadow-md">
                          <div className="flex items-center space-x-4">
                            <button onClick={() => toggleStatus(item.id)} className="shrink-0 transition-transform active:scale-90">
                              {item.status === 'Completed' ? <CheckCircle2 size={24} className="text-emerald-500" /> : <div className="w-6 h-6 border-2 border-zinc-300 rounded-full" />}
                            </button>
                            <div>
                              <p className={`font-bold text-sm ${item.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{item.title}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  item.priority === 'High' ? 'bg-red-100 text-red-600' : 
                                  item.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                                  'bg-emerald-100 text-emerald-600'
                                }`}>
                                  {item.priority === 'High' ? 'MendESAK' : item.priority === 'Medium' ? 'PENTING' : 'RINGAN'}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400 lowercase">{item.startTime} - {item.endTime}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingItem(item); setIsFormOpen(true); }} className="p-2 text-zinc-400 hover:text-blue-600"><Edit2 size={16} /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Bento Grid (Right Side) */}
            <div className="space-y-6">
              {/* Daily Schedule (Bento Block) */}
              <div className="bg-zinc-900 text-white rounded-[2rem] p-7 flex flex-col min-h-[400px] shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-base font-display">Agenda Hari Ini</h3>
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    <CalendarIcon size={18} className="text-zinc-500" />
                  </div>
                </div>

                <div className="space-y-5 flex-1">
                  {dayItems.length > 0 ? dayItems.map((item) => (
                    <div key={item.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1 border-2 border-zinc-900 ring-2 ${
                          item.priority === 'High' ? 'ring-red-500 bg-red-500' : 
                          item.priority === 'Medium' ? 'ring-amber-500 bg-amber-500' : 
                          'ring-emerald-500 bg-emerald-500'
                        }`}></div>
                        <div className="w-[1px] flex-1 bg-zinc-800 my-1 group-last:hidden"></div>
                      </div>
                      <div className="pb-4">
                        <p className="text-[10px] font-black text-zinc-500 font-mono tracking-tighter">{item.startTime}</p>
                        <h4 className={`font-bold text-sm leading-tight ${item.status === 'Completed' ? 'line-through text-zinc-500' : ''}`}>{item.title}</h4>
                      </div>
                    </div>
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-zinc-400 text-sm">
                      <p>Tidak ada agenda.</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}
                  className="mt-6 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest"
                >
                  TAMBAH AGENDA
                </button>
              </div>

              {/* Progress Card (Bento Block) */}
              <div className="bg-white rounded-[2rem] p-7 border border-zinc-200 shadow-sm flex flex-col justify-between h-44">
                <h3 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Efisiensi Mingguan</h3>
                <div className="flex items-end gap-3 mt-2">
                  <span className="text-4xl font-black font-display leading-none">84<span className="text-base text-zinc-300 font-medium">%</span></span>
                  <div className="flex items-center text-emerald-500 font-black text-[10px] mb-1">
                    <span>+12%</span>
                  </div>
                </div>
                <div className="mt-4 w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '84%' }}
                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  ></motion.div>
                </div>
              </div>

              {/* Category Focus (Bento Block) */}
              <div className="bg-yellow-100 rounded-[2rem] p-7 border border-yellow-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center text-yellow-900 shadow-sm">
                      <Bell size={18} />
                   </div>
                   <h3 className="font-black text-xs text-yellow-900 font-display">Status Fokus</h3>
                </div>
                <div className="space-y-4">
                  {['Pekerjaan', 'Kesehatan'].map((cat, i) => (
                    <div key={cat}>
                      <div className="flex justify-between text-[10px] font-black text-yellow-800 uppercase tracking-tighter mb-1">
                        <span>{cat}</span>
                        <span>{80 - i * 20}%</span>
                      </div>
                      <div className="h-2 bg-yellow-600/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${80 - i * 20}%` }}
                          className="h-full bg-yellow-600 rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isFormOpen && (
          <TaskForm 
            onClose={() => { setIsFormOpen(false); setEditingItem(undefined); }} 
            onSave={saveItem}
            initialData={editingItem}
            selectedDate={selectedDate}
          />
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}
