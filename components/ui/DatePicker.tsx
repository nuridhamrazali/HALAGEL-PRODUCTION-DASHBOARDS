import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { formatDateToDMYSlash, parseDMYToISO, getTodayISO } from '../../utils/dateUtils';

interface DatePickerProps {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  min?: string;
  max?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'DD/MM/YYYY',
  id,
  min,
  max
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState(() => formatDateToDMYSlash(value));
  
  // Year & Month currently displayed in calendar view
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value && value.includes('-')) {
      const y = parseInt(value.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value && value.includes('-')) {
      const m = parseInt(value.split('-')[1], 10);
      if (!isNaN(m)) return m - 1;
    }
    return new Date().getMonth();
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input text when value prop changes externally
  useEffect(() => {
    setInputText(formatDateToDMYSlash(value));
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y)) setViewYear(y);
        if (!isNaN(m)) setViewMonth(m);
      }
    }
  }, [value]);

  // Click outside listener to close calendar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handle direct typing in the input box with automatic DD/MM/YYYY formatting
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    // Allow digits, slashes, and dashes
    const cleaned = rawVal.replace(/[^\d/-]/g, '');

    // Auto-mask digits as user types if they don't enter slashes
    let formatted = cleaned;
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (!cleaned.includes('/') && !cleaned.includes('-')) {
      if (digitsOnly.length > 4) {
        formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
      } else if (digitsOnly.length > 2) {
        formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}`;
      } else {
        formatted = digitsOnly;
      }
    }

    setInputText(formatted);

    // If a complete 8-digit date has been formed (DD/MM/YYYY), attempt parsing immediately
    const parsedIso = parseDMYToISO(formatted);
    if (parsedIso) {
      onChange(parsedIso);
      const parts = parsedIso.split('-');
      setViewYear(parseInt(parts[0], 10));
      setViewMonth(parseInt(parts[1], 10) - 1);
    }
  };

  const handleInputBlur = () => {
    const parsedIso = parseDMYToISO(inputText);
    if (parsedIso) {
      onChange(parsedIso);
      setInputText(formatDateToDMYSlash(parsedIso));
    } else if (inputText.trim() === '') {
      if (!required) {
        onChange('');
      } else {
        setInputText(formatDateToDMYSlash(value));
      }
    } else {
      // Revert back to last valid value if invalid date string entered
      setInputText(formatDateToDMYSlash(value));
    }
  };

  const handleSelectDay = (year: number, month: number, day: number) => {
    const isoStr = `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onChange(isoStr);
    setInputText(formatDateToDMYSlash(isoStr));
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const todayIso = getTodayISO();
    onChange(todayIso);
    setInputText(formatDateToDMYSlash(todayIso));
    const parts = todayIso.split('-');
    setViewYear(parseInt(parts[0], 10));
    setViewMonth(parseInt(parts[1], 10) - 1);
    setIsOpen(false);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  // Generate calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays = [];

  // Trailing days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false
    });
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true
    });
  }

  // Leading days of next month to fill grid to multiple of 7
  const remainingSlots = 42 - calendarDays.length;
  if (remainingSlots > 0 && remainingSlots < 7) {
    for (let i = 1; i <= remainingSlots; i++) {
      calendarDays.push({
        day: i,
        month: viewMonth === 11 ? 0 : viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        isCurrentMonth: false
      });
    }
  }

  const todayIso = getTodayISO();
  const selectedIso = value;

  // Year options for dropdown: currentYear - 5 to currentYear + 5
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 10; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="relative inline-block w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`${className} pr-10 font-mono tracking-wide`}
          onClick={() => !disabled && setIsOpen(true)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open Calendar (DD/MM/YYYY)"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div 
          className="absolute left-0 top-full mt-2 z-50 w-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* Calendar Header with Month/Year Navigation */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent py-1 px-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent py-1 px-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 outline-none cursor-pointer"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels (Su, Mo, Tu, We, Th, Fr, Sa) */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {WEEKDAY_NAMES.map((day, idx) => {
              const isWeekend = idx === 5 || idx === 6; // Halagel Rest Day / Off Day (Fri / Sat)
              return (
                <div
                  key={day}
                  className={`text-[10px] font-black uppercase py-1 ${
                    isWeekend ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                  title={idx === 5 ? 'Friday (Off Day)' : idx === 6 ? 'Saturday (Rest Day)' : day}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((cell, idx) => {
              const cellIso = `${cell.year.toString().padStart(4, '0')}-${(cell.month + 1).toString().padStart(2, '0')}-${cell.day.toString().padStart(2, '0')}`;
              const isSelected = selectedIso === cellIso;
              const isToday = todayIso === cellIso;

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  type="button"
                  onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                  className={`
                    relative h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-lg font-bold transition-all
                    ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600'
                        : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }
                    ${isToday && !isSelected ? 'border border-indigo-500 font-black text-indigo-600 dark:text-indigo-400' : ''}
                  `}
                >
                  {cell.day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 bg-indigo-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer with Today Shortcut and Format Indicator */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
              Format: DD/MM/YYYY
            </span>
            <button
              type="button"
              onClick={handleSetToday}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
            >
              <RotateCcw className="w-3 h-3" />
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
