import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { ScheduleItem } from '../types';

interface CalendarProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  items: ScheduleItem[];
}

export default function Calendar({ onDateSelect, selectedDate, items }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-6 py-6 bg-white border-b border-zinc-100">
        <h2 className="text-xl font-black text-zinc-900 capitalize font-display">
          {format(currentMonth, 'MMMM yyyy', { locale: id })}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-zinc-100 rounded-xl transition-all"
            id="prev-month-btn"
          >
            <ChevronLeft size={20} className="text-zinc-600" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-zinc-100 rounded-xl transition-all"
            id="next-month-btn"
          >
            <ChevronRight size={20} className="text-zinc-600" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return (
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
        {days.map((day) => (
          <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 upper tracking-widest uppercase">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);
        
        const dayItems = items.filter(item => isSameDay(parseISO(item.date), cloneDay));

        days.push(
          <div
            key={day.toString()}
            className={`relative min-h-[100px] border-r border-b border-zinc-50 flex flex-col p-2 cursor-pointer transition-all hover:bg-blue-50/50 ${
              !isCurrentMonth ? "bg-zinc-50/30" : "bg-white"
            } ${isSelected ? "bg-blue-50/80 ring-2 ring-blue-600 ring-inset" : ""}`}
            onClick={() => onDateSelect(cloneDay)}
            id={`calendar-cell-${format(day, 'yyyy-MM-dd')}`}
          >
            <span className={`text-[11px] font-bold ml-1 mt-1 ${
              !isCurrentMonth ? "text-zinc-300" : isSameDay(day, new Date()) ? "text-blue-600 font-black" : "text-zinc-900"
            }`}>
              {formattedDate}
            </span>
            <div className="mt-2 space-y-1 overflow-hidden">
              {dayItems.slice(0, 3).map((item) => (
                <div 
                  key={item.id} 
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg truncate border shadow-sm ${
                    item.category === 'Work' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    item.category === 'Health' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    item.category === 'Personal' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    'bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                >
                  {item.title}
                </div>
              ))}
              {dayItems.length > 3 && (
                <div className="text-[8px] font-black text-zinc-400 text-center uppercase tracking-tighter">
                  +{dayItems.length - 3} ITEM LAIN
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white">{rows}</div>;
  };

  return (
    <div className="w-full bg-white rounded-[2rem] shadow-sm border border-zinc-200 overflow-hidden" id="calendar-container">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}
