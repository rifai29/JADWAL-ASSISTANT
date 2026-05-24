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
      <div className="h-screen w-screen flex bg-zinc-50 font-sans overflow-hidden">
        {/* Left Side: Auth & Branding */}
        <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 md:p-16 lg:p-20 relative z-10 bg-white shadow-2xl">
          {/* Header & Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-zinc-950 rounded-xl flex items-center justify-center text-white shadow-md shadow-zinc-300">
                <CalendarIcon size={18} />
              </div>
              <span className="text-lg font-black tracking-tighter text-zinc-900 font-display">
                Jadwal<span className="text-blue-600">PRO</span>
              </span>
            </div>
            
            <div className="text-[10px] font-black text-zinc-400 tracking-wider bg-zinc-100 px-3 py-1 rounded-full uppercase">
              v4.2.0 • Stable
            </div>
          </div>

          {/* Main Hero & Auth Area */}
          <div className="w-full max-w-md mx-auto my-auto space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-wider">
                <Sparkles size={12} className="animate-pulse" />
                <span>Asisten Waktu AI Terpadu</span>
              </div>
              
              <h2 className="text-3xl lg:text-4xl font-extrabold text-zinc-900 leading-tight font-display tracking-tight">
                Kelola Waktumu Dengan <br />
                <span className="text-blue-600 relative inline-block">
                  Lebih Pintar.
                  <span className="absolute left-0 bottom-1 w-full h-[3px] bg-blue-100 -z-10 rounded-full"></span>
                </span>
              </h2>
              
              <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                Sistem penjadwalan terpadu dengan bento grid cerdas, statistik alokasi waktu, serta asisten AI pribadi yang mengoptimalkan efisiensi harian Anda.
              </p>
            </div>

            {/* Login Button */}
            <div className="space-y-4">
              <button 
                onClick={loginWithGoogle}
                className="w-full py-3.5 px-6 bg-zinc-950 text-white rounded-2xl font-bold flex items-center justify-center space-x-3 hover:bg-black hover:shadow-xl hover:shadow-zinc-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-xs tracking-wider uppercase active:scale-98"
                id="login-google-btn"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white p-0.5 rounded-full" />
                <span>Lanjutkan dengan Google</span>
              </button>
              
              <p className="text-center text-[10px] text-zinc-400 font-bold leading-relaxed">
                Akses aman dan instan • Dengan masuk, Anda setuju dengan ketentuan layanan.
              </p>
            </div>

            {/* Premium Highlights */}
            <div className="pt-8 border-t border-zinc-100 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 mt-0.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-800 leading-none">Bento Calendar Integration</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-bold">Atur agenda harian dan bulanan dengan interface super seimbang.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 mt-0.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-800 leading-none">Statistik & Kategori Otomatis</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-bold">Lihat alokasi waktu mingguan berdasarkan pekerjaan & kesehatan.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100 mt-0.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-800 leading-none">Rekomendasi Pintar AI Insights</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-bold">Saran efisiensi instan yang disesuaikan dengan pola kegiatan Anda.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer branding */}
          <div className="flex items-center justify-between text-zinc-400 text-[9px] font-black uppercase tracking-widest">
            <span>© 2026 JADWALPRO CO.</span>
            <span>CRAFTED FOR PEAK PERFORMANCE</span>
          </div>
        </div>

        {/* Right Side: Futuristic Dark Preview */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-12 xl:p-16 items-center justify-center relative overflow-hidden">
          {/* Subtle Ambient Glows */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -ml-32 -mb-32"></div>
          <div className="absolute w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>

          {/* Live Mockup Interface Grid */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 w-full max-w-xl bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] border border-zinc-800 shadow-2xl p-6 select-none"
          >
            {/* Window control bar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/80">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400/80"></div>
              </div>
              <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl px-4 py-1 text-[10px] text-zinc-500 font-mono tracking-tight w-64 text-center">
                app.jadwalpro.com
              </div>
              <div className="w-12"></div>
            </div>

            {/* Layout simulation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box 1: Dynamic AI Dialog simulation */}
              <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg shadow-blue-900/20">
                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 bg-white/20 rounded-lg">
                      <Sparkles size={14} className="text-yellow-300" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-90 font-display">AI PRO INSIGHT</span>
                  </div>
                  <p className="text-sm font-bold leading-snug font-display">
                    "Hari ini alokasi waktu Anda sangat seimbang. Selesaikan deep work Anda sebelum jam 11 siang untuk fokus paling optimal."
                  </p>
                </div>
                <div className="absolute top-1/2 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
              </div>

              {/* Box 2: Elegant Schedule Items */}
              <div className="bg-zinc-800/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-display">Agenda Terencana</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                </div>

                <div className="space-y-2.5">
                  <div className="p-2.5 bg-zinc-950/40 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-white">09:00 Deep Work: UI Kit</p>
                      <span className="text-[8px] bg-blue-950 text-blue-400 border border-blue-900/30 px-1.5 py-0.5 rounded shadow-sm font-black uppercase">WORK</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-950/40 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-white">14:00 Rakat Tim Desain</p>
                      <span className="text-[8px] bg-purple-950 text-purple-400 border border-purple-900/30 px-1.5 py-0.5 rounded shadow-sm font-black uppercase">PERSONAL</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Modern Analytics preview */}
              <div className="bg-zinc-800/40 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between h-44">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] font-display">Efisiensi Mingguan</span>
                  <p className="text-3xl font-black font-display text-white mt-1">84%</p>
                  <span className="text-[9px] text-emerald-400 font-bold leading-none">+12% dari minggu lalu</span>
                </div>

                <div className="space-y-3">
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[84%]"></div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
                    <span>Low</span>
                    <span>Target Target</span>
                    <span>Peak</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
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
        <header className="h-18 md:h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center bg-zinc-100 px-4 py-2.5 rounded-2xl border border-zinc-200 w-[60%] sm:w-72 md:w-80 lg:w-96 transition-all sm:focus-within:w-[320px] md:focus-within:w-[420px] focus-within:shadow-md">
            <Search size={18} className="text-zinc-400 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Cari agenda..." 
              className="bg-transparent border-none outline-none text-sm md:text-xs w-full font-bold text-zinc-900 placeholder-zinc-400"
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
            <div className="flex items-center space-x-3 pl-3 sm:pl-4 lg:pl-6 border-l border-zinc-200">
              <img src={user.photoURL || ''} alt="User" className="w-10 h-10 sm:w-9 sm:h-9 md:w-8 md:h-8 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-105 transition-all" />
            </div>
          </div>
        </header>

        {/* Bento Grid Area */}
        <div className="flex-1 p-4 sm:p-5 pb-32 md:pb-5 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:grid-cols-3 sm:gap-5">
            
            {/* Action Bar (Top Full Width) */}
            <div className="md:col-span-3 flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 font-display">
                  {view === 'calendar' ? 'Alur Waktu' : view === 'stats' ? 'Analisis' : 'Semua Tugas'}
                </h2>
                <p className="text-zinc-500 font-medium uppercase text-[9px] tracking-widest mt-0.5">Manajemen Jadwal Terperinci • v4.2</p>
              </div>
              <button 
                onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}
                className="bg-zinc-900 text-white px-5 py-3 sm:py-2.5 rounded-2xl text-sm sm:text-xs font-bold flex items-center space-x-2 hover:bg-black transition-all shadow-xl shadow-zinc-200 active:scale-95 shrink-0"
                id="add-task-header-btn"
              >
                <Plus size={18} />
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

      {/* Mobile Floating Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 bg-zinc-900/95 backdrop-blur-md rounded-3xl border border-zinc-800 shadow-[0_12px_36px_-5px_rgba(0,0,0,0.3)] px-5 py-2 flex items-center justify-around">
        {[
          { id: 'calendar', icon: CalendarIcon, label: 'Kalender' },
          { id: 'list', icon: CheckSquare, label: 'Tugas' },
          { id: 'stats', icon: StatsIcon, label: 'Statistik' }
        ].map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative active:scale-90"
              style={{ minWidth: '4.5rem' }}
            >
              <item.icon size={22} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
               <span className={`text-[10px] mt-1 font-bold ${isActive ? 'text-white font-extrabold' : 'text-zinc-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-400" />
              )}
            </button>
          );
        })}
        {/* Mobile Logout Option */}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center p-2 rounded-2xl text-zinc-500 active:text-red-400 active:scale-90"
          style={{ minWidth: '4.5rem' }}
        >
          <LogOut size={22} />
          <span className="text-[10px] mt-1 font-bold">Keluar</span>
        </button>
      </div>

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
