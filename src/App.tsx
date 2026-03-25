import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
import { createPortal } from 'react-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  googleProvider, 
  auth, 
  db,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  handleFirestoreError,
  OperationType
} from './firebase';
import { User } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Receipt, 
  Target, 
  Bell, 
  LogOut, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Calendar,
  CheckCircle2,
  Circle,
  Trash2,
  X,
  Menu,
  Pencil,
  Filter,
  RotateCcw,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  ChevronLeft,
  Camera,
  Smartphone,
  Sun,
  Moon,
  FileUp,
  FileSpreadsheet,
  Newspaper,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency } from './lib/utils';
import { CurrencyInput } from './components/CurrencyInput';
import { Transaction, Goal, Reminder, UserProfile, Notification as AppNotification, Asset, Dividend } from './types';
import { ImportExport } from './components/ImportExport';
import { NewsCarousel } from './components/NewsCarousel';

const getInitials = (firstName?: string, lastName?: string, displayName?: string) => {
  if (firstName || lastName) {
    const first = firstName?.[0] || '';
    const last = lastName ? lastName.split(' ').filter(Boolean).map(n => n[0]).join('') : '';
    return (first + last).toUpperCase().slice(0, 3);
  }
  if (displayName) {
    return displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 3);
  }
  return 'U';
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'goals' | 'reminders' | 'investments' | 'import'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (isMobileMenuOpen || isNotificationPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen, isNotificationPanelOpen]);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [showNews, setShowNews] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check if news has been shown in this session
        const newsShown = sessionStorage.getItem('news_shown');
        if (!newsShown) {
          setShowNews(true);
          sessionStorage.setItem('news_shown', 'true');
        }

        setCheckingProfile(true);
        try {
          const path = `users/${user.uid}`;
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        } finally {
          setCheckingProfile(false);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qTransactions = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoadingTransactions(false);
    }, (error) => {
      setLoadingTransactions(false);
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const qGoals = query(collection(db, 'goals'), where('uid', '==', user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      setGoals(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goals'));

    const qReminders = query(collection(db, 'reminders'), where('uid', '==', user.uid));
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(data.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reminders'));

    const qNotifications = query(collection(db, 'notifications'), where('uid', '==', user.uid));
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    const qAssets = query(collection(db, 'assets'), where('uid', '==', user.uid));
    const unsubAssets = onSnapshot(qAssets, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setAssets(data);
      setLoadingAssets(false);
    }, (error) => {
      setLoadingAssets(false);
      handleFirestoreError(error, OperationType.LIST, 'assets');
    });

    const qDividends = query(collection(db, 'dividends'), where('uid', '==', user.uid));
    const unsubDividends = onSnapshot(qDividends, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dividend));
      setDividends(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'dividends'));

    return () => {
      unsubTransactions();
      unsubGoals();
      unsubReminders();
      unsubNotifications();
      unsubAssets();
      unsubDividends();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id!), { isRead: true })));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  // Check for due reminders and create notifications
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    const checkReminders = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const reminder of reminders) {
        if (reminder.isPaid) continue;
        
        const dueDate = new Date(reminder.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        // If due today or overdue
        if (isBefore(dueDate, new Date()) || dueDate.getTime() === today.getTime()) {
          // Check if we already notified for this reminder today
          const alreadyNotified = notifications.some(n => 
            n.relatedId === reminder.id && 
            new Date(n.createdAt).toDateString() === new Date().toDateString()
          );

          if (!alreadyNotified) {
            try {
              await addDoc(collection(db, 'notifications'), {
                uid: user.uid,
                title: 'Lembrete de Pagamento',
                message: `Sua conta "${reminder.title}" de ${formatCurrency(reminder.amount)} vence hoje ou está atrasada!`,
                type: 'reminder',
                createdAt: new Date().toISOString(),
                isRead: false,
                relatedId: reminder.id
              });

              // Browser Notification
              console.log('Attempting to show browser notification for:', reminder.title);
              if (Notification.permission === 'granted') {
                console.log('Permission granted, showing notification');
                new Notification('FinTrack: Lembrete de Pagamento', {
                  body: `Sua conta "${reminder.title}" vence hoje!`,
                  icon: '/favicon.ico'
                });
              } else {
                console.log('Notification permission status:', Notification.permission);
              }
            } catch (error) {
              console.error('Error creating notification:', error);
            }
          }
        }
      }
    };

    checkReminders();
  }, [reminders, user, userProfile]);

  // Request browser notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [updatingTickers, setUpdatingTickers] = useState<Set<string>>(new Set());
  const [isInitialLoadingPrices, setIsInitialLoadingPrices] = useState(true);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const checkedTickers = useRef<Set<string>>(new Set());
  const dividendsRef = useRef(dividends);

  useEffect(() => {
    dividendsRef.current = dividends;
  }, [dividends]);

  const updatePrices = useCallback(async (force = false) => {
    if (!assets || assets.length === 0) {
      setIsInitialLoadingPrices(false);
      return;
    }

    if (isUpdatingPrices) return;

    const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
    const now = Date.now();
    const currentMonth = format(new Date(), 'yyyy-MM');

    if (force) {
      checkedTickers.current.clear();
    }

    const tickersToUpdate = assets
      .map(a => a.ticker.toUpperCase())
      .filter(ticker => {
        if (checkedTickers.current.has(ticker)) return false;
        return true;
      });

    if (tickersToUpdate.length === 0) {
      setIsInitialLoadingPrices(false);
      return;
    }

    setIsUpdatingPrices(true);
    setUpdatingTickers(new Set(tickersToUpdate));
    try {
      const staleTickers: string[] = [];
      const currentPrices = { ...marketPrices };

      for (const ticker of tickersToUpdate) {
        const priceDoc = await getDoc(doc(db, 'market_prices', ticker));
        const docData = priceDoc.data();
        
        // Check if price is stale
        const isPriceStale = force || !docData || (now - (docData.updatedAt || 0) > CACHE_DURATION);
        
        // Check if dividend info is stale for the current month
        const nextDividendCheck = docData?.nextDividendCheckDate ? new Date(docData.nextDividendCheckDate).getTime() : 0;
        const isDividendStale = force || !docData || 
                                docData.dividendMonth !== currentMonth || 
                                (!docData.dividendAnnounced && now >= nextDividendCheck);
        
        if (isPriceStale || isDividendStale) {
          staleTickers.push(ticker);
        }
        
        if (docData) {
          currentPrices[ticker] = docData.price;
          checkedTickers.current.add(ticker);

          // If dividend was already announced and stored, but not in user's dividends, add it
          if (docData.dividendMonth === currentMonth && docData.dividendAnnounced && docData.dividendValue > 0 && docData.dividendPaymentDate) {
            const userHasDividend = dividendsRef.current.some(d => 
              d.ticker === ticker && d.month === currentMonth
            );

            if (!userHasDividend) {
              const totalQuantity = assets.filter(a => a.ticker === ticker).reduce((sum, a) => sum + a.quantity, 0);
              if (totalQuantity > 0) {
                const dividendData: Omit<Dividend, 'id'> = {
                  uid: user.uid,
                  ticker: ticker,
                  date: docData.dividendPaymentDate,
                  month: currentMonth,
                  quantity: totalQuantity,
                  valuePerShare: docData.dividendValue,
                  total: totalQuantity * docData.dividendValue
                };
                addDoc(collection(db, 'dividends'), dividendData).then(() => {
                  // Create notification for new dividend
                  addDoc(collection(db, 'notifications'), {
                    uid: user.uid,
                    title: 'Novo Provento Detectado',
                    message: `Um novo dividendo de ${ticker} foi anunciado: ${formatCurrency(dividendData.total)} com pagamento em ${format(parseISO(dividendData.date), 'dd/MM/yyyy')}.`,
                    type: 'dividend',
                    createdAt: new Date().toISOString(),
                    isRead: false,
                    relatedId: ticker
                  });

                  // Browser Notification
                  if (Notification.permission === 'granted') {
                    new Notification('FinTrack: Novo Provento', {
                      body: `${ticker} anunciou ${formatCurrency(dividendData.total)} em dividendos!`,
                      icon: '/favicon.ico'
                    });
                  }
                }).catch(err => 
                  console.error(`Error creating dividend for ${ticker}:`, err)
                );
              }
            }
          }
        }
      }

      setMarketPrices(currentPrices);
      setIsInitialLoadingPrices(false);

      if (staleTickers.length > 0) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `Hoje é ${new Date().toLocaleDateString('pt-BR')}.
        Pesquise na internet (StatusInvest, Infomoney, B3) e retorne o preço ATUAL de fechamento ou cotação em tempo real e informações de dividendos para os seguintes ativos brasileiros (B3): ${staleTickers.join(', ')}.
        
        Para dividendos:
        1. Considere apenas proventos anunciados com data de pagamento ou "data com" no mês de ${currentMonth}.
        2. Se um dividendo foi anunciado para este mês, retorne dividendAnnounced como true, o valor por cota (dividendValue) e a data de pagamento (dividendPaymentDate).
        3. Se ainda não houve anúncio para este mês, retorne dividendAnnounced como false.
        4. IMPORTANTE: O valor do dividendo (dividendValue) DEVE ter até 4 casas decimais de precisão (ex: 0.0836).
        5. Verifique se houve desdobramentos (splits) recentes para garantir que o preço e o dividendo estejam na base correta (ex: ALZR11 agora custa por volta de R$ 10-11 após o desdobramento).

        Retorne APENAS um JSON no formato:
        {
          "TICKER": { 
            "price": 0.00, 
            "dividendAnnounced": true, 
            "dividendValue": 0.0000, 
            "dividendPaymentDate": "YYYY-MM-DD",
            "nextDividendCheckDate": "YYYY-MM-DDTHH:MM:SSZ"
          }
        }`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json" 
          }
        });

        const result = JSON.parse(response.text || '{}');
        
        if (result) {
          for (const ticker of staleTickers) {
            const data = result[ticker] || result[ticker.replace('.SA', '')];
            if (data) {
              const docData = {
                price: data.price,
                dividendAnnounced: data.dividendAnnounced || false,
                dividendValue: data.dividendValue || 0,
                dividendPaymentDate: data.dividendPaymentDate || null,
                dividendMonth: currentMonth,
                nextDividendCheckDate: data.nextDividendCheckDate || new Date(now + 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: now
              };
              currentPrices[ticker] = data.price;
              checkedTickers.current.add(ticker);

              if (docData.dividendAnnounced && docData.dividendValue > 0 && docData.dividendPaymentDate) {
                const userHasDividend = dividendsRef.current.some(d => 
                  d.ticker === ticker && d.month === currentMonth
                );

                if (!userHasDividend) {
                  const totalQuantity = assets.filter(a => a.ticker === ticker).reduce((sum, a) => sum + a.quantity, 0);
                  if (totalQuantity > 0) {
                    const dividendData: Omit<Dividend, 'id'> = {
                      uid: user.uid,
                      ticker: ticker,
                      date: docData.dividendPaymentDate,
                      month: currentMonth,
                      quantity: totalQuantity,
                      valuePerShare: docData.dividendValue,
                      total: totalQuantity * docData.dividendValue
                    };
                    addDoc(collection(db, 'dividends'), dividendData).then(() => {
                      // Create notification for new dividend
                      addDoc(collection(db, 'notifications'), {
                        uid: user.uid,
                        title: 'Novo Provento Detectado',
                        message: `Um novo dividendo de ${ticker} foi anunciado: ${formatCurrency(dividendData.total)} com pagamento em ${format(parseISO(dividendData.date), 'dd/MM/yyyy')}.`,
                        type: 'dividend',
                        createdAt: new Date().toISOString(),
                        isRead: false,
                        relatedId: ticker
                      });

                      // Browser Notification
                      if (Notification.permission === 'granted') {
                        new Notification('FinTrack: Novo Provento', {
                          body: `${ticker} anunciou ${formatCurrency(dividendData.total)} em dividendos!`,
                          icon: '/favicon.ico'
                        });
                      }
                    }).catch(err => 
                      console.error(`Error creating dividend for ${ticker}:`, err)
                    );
                  }
                }
              }

              try {
                await setDoc(doc(db, 'market_prices', ticker), docData, { merge: true });
              } catch (err) {
                console.error(`Error updating market_prices for ${ticker}:`, err);
              }
            }
          }
          setMarketPrices({ ...currentPrices });
        }
      }
    } catch (err) {
      console.error("Error updating prices:", err);
    } finally {
      setIsUpdatingPrices(false);
      setUpdatingTickers(new Set());
    }
  }, [assets, user, marketPrices]);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'investments') {
      updatePrices();
    }
  }, [assets, activeTab, updatePrices]);

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center transition-colors">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  if (!userProfile || isEditingProfile) {
    return (
      <ProfileSetup 
        user={user} 
        initialProfile={userProfile || undefined} 
        onComplete={(profile) => {
          setUserProfile(profile);
          setIsEditingProfile(false);
        }} 
        onCancel={userProfile ? () => setIsEditingProfile(false) : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col md:flex-row relative transition-colors duration-300">
      {/* Mobile Header */}
      <header className="md:hidden bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 p-4 flex items-center justify-between sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-stone-900 dark:text-stone-50">FinTrack</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all"
          >
            {theme === 'light' ? <Moon className="w-6 h-6 text-stone-600 dark:text-stone-400" /> : <Sun className="w-6 h-6 text-stone-600 dark:text-stone-400" />}
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all relative"
            >
              <Bell className="w-6 h-6 text-stone-600 dark:text-stone-400" />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
            <NotificationPanel 
              isOpen={isNotificationPanelOpen} 
              onClose={() => setIsNotificationPanelOpen(false)}
              notifications={notifications}
              onMarkAsRead={markNotificationAsRead}
              onClearAll={clearAllNotifications}
            />
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-stone-100 rounded-xl transition-all"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-stone-600 dark:text-stone-400" /> : <Menu className="w-6 h-6 text-stone-600 dark:text-stone-400" />}
          </button>
        </div>
      </header>

      {/* Sidebar / Mobile Menu Overlay */}
      <AnimatePresence>
        {(isMobileMenuOpen || window.innerWidth >= 768) && (
          <motion.aside 
            key="sidebar"
            initial={window.innerWidth < 768 ? { x: -300, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-8 md:relative md:translate-x-0 transition-colors",
              !isMobileMenuOpen && "hidden md:flex"
            )}
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-stone-900 dark:text-stone-50">FinTrack</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={toggleTheme}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5 text-stone-600 dark:text-stone-400" /> : <Sun className="w-5 h-5 text-stone-600 dark:text-stone-400" />}
                </button>
                <div className="relative md:block hidden">
                  <button 
                    onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
                    className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-all relative"
                  >
                    <Bell className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </button>
                  <NotificationPanel 
                    isOpen={isNotificationPanelOpen} 
                    onClose={() => setIsNotificationPanelOpen(false)}
                    notifications={notifications}
                    onMarkAsRead={markNotificationAsRead}
                    onClearAll={clearAllNotifications}
                    align="left"
                  />
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 hover:bg-stone-100 rounded-full">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

              <nav className="flex flex-col gap-2 flex-1">
                <NavItem 
                  icon={<LayoutDashboard className="w-5 h-5" />} 
                  label="Dashboard" 
                  active={activeTab === 'dashboard'} 
                  onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
                />
                <NavItem 
                  icon={<Receipt className="w-5 h-5" />} 
                  label="Transações" 
                  active={activeTab === 'transactions'} 
                  onClick={() => { setActiveTab('transactions'); setIsMobileMenuOpen(false); }} 
                />
                <NavItem 
                  icon={<Target className="w-5 h-5" />} 
                  label="Metas" 
                  active={activeTab === 'goals'} 
                  onClick={() => { setActiveTab('goals'); setIsMobileMenuOpen(false); }} 
                />
                <NavItem 
                  icon={<Bell className="w-5 h-5" />} 
                  label="Lembretes" 
                  active={activeTab === 'reminders'} 
                  onClick={() => { setActiveTab('reminders'); setIsMobileMenuOpen(false); }} 
                />
                <NavItem 
                  icon={<TrendingUp className="w-5 h-5" />} 
                  label="Investimentos" 
                  active={activeTab === 'investments'} 
                  onClick={() => { setActiveTab('investments'); setIsMobileMenuOpen(false); }} 
                />
                {/* <NavItem 
                  icon={<FileSpreadsheet className="w-5 h-5" />} 
                  label="Importar" 
                  active={activeTab === 'import'} 
                  onClick={() => { setActiveTab('import'); setIsMobileMenuOpen(false); }} 
                /> */}
                <NavItem 
                  icon={<Newspaper className="w-5 h-5" />} 
                  label="Notícias" 
                  active={showNews} 
                  onClick={() => { setShowNews(true); setIsMobileMenuOpen(false); }} 
                />
              </nav>

            <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center border-2 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold overflow-hidden text-xs">
                  {(userProfile?.photoURL || user?.photoURL) ? (
                    <img src={userProfile?.photoURL || user?.photoURL || ''} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    getInitials(userProfile?.firstName, userProfile?.lastName, user?.displayName || undefined)
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold text-stone-900 dark:text-stone-50 truncate">
                    {userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName || ''}` : (user?.displayName || 'Usuário')}
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400 truncate">{userProfile?.email || user?.email}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <button 
                  onClick={() => { setIsEditingProfile(true); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                >
                  <UserIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Editar Perfil</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Sair</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-73px)] md:h-screen">
        <AnimatePresence mode="wait">
          {showNews && (
            <NewsCarousel key="news-carousel" onClose={() => setShowNews(false)} />
          )}
          {activeTab === 'dashboard' && (
            <Dashboard 
              key="dashboard"
              transactions={transactions} 
              goals={goals} 
              reminders={reminders} 
              dividends={dividends}
              onNavigate={(tab) => setActiveTab(tab)}
              theme={theme}
            />
          )}
          {activeTab === 'transactions' && (
            <Transactions key="transactions" transactions={transactions} user={user} isLoading={loadingTransactions} />
          )}
          {activeTab === 'goals' && (
            <Goals key="goals" goals={goals} user={user} />
          )}
          {activeTab === 'reminders' && (
            <Reminders key="reminders" reminders={reminders} user={user} />
          )}
          {activeTab === 'investments' && (
            <Investments 
              key="investments" 
              assets={assets} 
              dividends={dividends} 
              user={user} 
              isLoading={loadingAssets}
              marketPrices={marketPrices}
              isUpdatingPrices={isUpdatingPrices}
              updatingTickers={updatingTickers}
              isInitialLoadingPrices={isInitialLoadingPrices}
              checkedTickers={checkedTickers}
              updatePrices={updatePrices}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [method, setMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetSent(false);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error('Auth error:', err.code, err.message);
      
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('E-mail ou senha incorretos. Verifique seus dados ou cadastre-se se ainda não tiver uma conta.');
          break;
        case 'auth/email-already-in-use':
          setError('Este e-mail já está em uso. Tente fazer login em vez de se cadastrar.');
          break;
        case 'auth/weak-password':
          setError('A senha deve ter pelo menos 6 caracteres.');
          break;
        case 'auth/invalid-email':
          setError('Por favor, insira um endereço de e-mail válido.');
          break;
        case 'auth/operation-not-allowed':
          setError('Este método de login não está habilitado. Por favor, entre em contato com o administrador.');
          break;
        case 'auth/too-many-requests':
          setError('Muitas tentativas sem sucesso. Sua conta foi temporariamente bloqueada. Tente novamente mais tarde.');
          break;
        default:
          setError('Ocorreu um erro ao tentar acessar sua conta. Por favor, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    setError('');
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      console.error('Reset error:', err);
      setError('Erro ao enviar e-mail de recuperação. Verifique se o e-mail está correto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-xl shadow-stone-200/50 dark:shadow-none border border-transparent dark:border-stone-800"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Bem-vindo ao FinTrack</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Escolha como deseja acessar sua conta</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.
          </div>
        )}

        <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl mb-8">
          <button 
            onClick={() => setMethod('google')}
            className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", method === 'google' ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-50 shadow-sm" : "text-stone-500 dark:text-stone-400")}
          >
            Google
          </button>
          <button 
            onClick={() => setMethod('email')}
            className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", method === 'email' ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-50 shadow-sm" : "text-stone-500 dark:text-stone-400")}
          >
            E-mail
          </button>
        </div>

        {method === 'google' && (
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-200 font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Continuar com Google
          </button>
        )}

        {method === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 dark:text-stone-500" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" 
                  placeholder="seu@email.com" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">Senha</label>
                {!isRegistering && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 dark:text-stone-500" />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
            >
              {loading ? 'Processando...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
            </button>
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-stone-500 dark:text-stone-400 text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
            </button>
          </form>
        )}

      </motion.div>
    </div>
  );
}

function ProfileSetup({ user, onComplete, initialProfile, onCancel }: { 
  user: User, 
  onComplete: (profile: UserProfile) => void,
  initialProfile?: UserProfile,
  onCancel?: () => void
}) {
  const [formData, setFormData] = useState({
    firstName: initialProfile?.firstName || (user.displayName ? user.displayName.split(' ')[0] : ''),
    lastName: initialProfile?.lastName || (user.displayName ? user.displayName.split(' ').slice(1).join(' ') : ''),
    email: user.email || '',
    photoURL: initialProfile?.photoURL || user.photoURL || '',
    currency: initialProfile?.currency || 'BRL'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setError('A imagem é muito grande. Por favor, escolha uma imagem com menos de 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const profile: UserProfile = {
        uid: user.uid,
        ...formData
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      onComplete(profile);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-xl shadow-stone-200/50 dark:shadow-none border border-transparent dark:border-stone-800"
      >
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto mb-4 group">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-stone-800 shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                  {getInitials(formData.firstName, formData.lastName, user.displayName || undefined)}
                </span>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg border-2 border-white dark:border-stone-800 hover:bg-emerald-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
            {initialProfile ? 'Editar Perfil' : 'Complete seu Perfil'}
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            {initialProfile ? 'Mantenha seus dados atualizados' : 'Precisamos de mais alguns dados para começar'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">Nome *</label>
              <input 
                type="text" 
                maxLength={50}
                required 
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" 
                placeholder="João" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">Sobrenome</label>
              <input 
                type="text" 
                maxLength={50}
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" 
                placeholder="Silva" 
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">E-mail (Não editável)</label>
            <input 
              type="email" 
              disabled
              value={formData.email}
              className="w-full px-4 py-3 bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-500 dark:text-stone-400 cursor-not-allowed outline-none" 
            />
            <p className="text-[10px] text-stone-400 dark:text-stone-500">O e-mail da conta não pode ser alterado.</p>
          </div>
          
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button 
                type="button"
                onClick={onCancel}
                className="flex-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold py-4 px-6 rounded-2xl transition-all"
              >
                Cancelar
              </button>
            )}
            <button 
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50",
                !onCancel && "w-full"
              )}
            >
              {loading ? 'Salvando...' : (initialProfile ? 'Salvar Alterações' : 'Começar a Usar')}
              {!initialProfile && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
        active 
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-100 dark:shadow-none" 
          : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Dashboard({ transactions, goals, reminders, dividends, onNavigate, theme }: { transactions: Transaction[], goals: Goal[], reminders: Reminder[], dividends: Dividend[], onNavigate: (tab: any) => void, theme: 'light' | 'dark' }) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthTransactions = transactions.filter(t => t.month === currentMonth);
  const monthDividends = dividends.filter(d => d.month === currentMonth);
  
  const incomeTransactions = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalDividends = monthDividends.reduce((acc, d) => acc + d.total, 0);
  const totalIncome = incomeTransactions + totalDividends;
  const totalExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  const chartData = [
    { name: 'Entradas', value: incomeTransactions, color: '#10b981' },
    { name: 'Dividendos', value: totalDividends, color: '#8b5cf6' },
    { name: 'Saídas', value: totalExpenses, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const categoryData = Object.entries(
    monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Dashboard</h2>
        <p className="text-stone-500 dark:text-stone-400">Resumo financeiro de {format(new Date(), 'MMMM yyyy', { locale: ptBR })}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo Atual" value={balance} icon={<Wallet className="w-6 h-6" />} color="emerald" trend={balance >= 0 ? 'up' : 'down'} />
        <StatCard title="Total Entradas" value={totalIncome} icon={<TrendingUp className="w-6 h-6" />} color="blue" />
        <StatCard title="Total Saídas" value={totalExpenses} icon={<TrendingDown className="w-6 h-6" />} color="red" />
        <StatCard title="Dividendos" value={totalDividends} icon={<TrendingUp className="w-6 h-6" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-6">Visão Geral</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#292524' : '#f1f5f9'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#a8a29e' : '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#a8a29e' : '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? '#1c1917' : '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                    color: theme === 'dark' ? '#fafaf9' : '#1c1917'
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#fafaf9' : '#1c1917' }}
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-6">Gastos por Categoria</h3>
          <div className="h-64">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                      color: theme === 'dark' ? '#fafaf9' : '#1c1917'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fafaf9' : '#1c1917' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400 italic">
                Nenhum gasto registrado este mês
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm lg:col-span-2 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Progresso das Metas (Este Mês)</h3>
            <Target className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="h-[300px] w-full">
            {goals.filter(g => g.month === currentMonth).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={goals.filter(g => g.month === currentMonth).map(g => ({
                    name: g.title,
                    atual: g.currentAmount,
                    alvo: g.targetAmount
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#292524' : '#f5f5f5'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#a8a29e' : '#78716c', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#a8a29e' : '#78716c', fontSize: 12 }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: theme === 'dark' ? '#1c1917' : '#f5f5f0' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                      color: theme === 'dark' ? '#fafaf9' : '#1c1917'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fafaf9' : '#1c1917' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="atual" name="Valor Atual" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alvo" name="Valor Alvo" fill={theme === 'dark' ? '#292524' : '#e5e7eb'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 italic">
                <Target className="w-12 h-12 mb-2 opacity-20" />
                <p>Nenhuma meta ativa para este mês</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Transações Recentes</h3>
            <button 
              onClick={() => onNavigate('transactions')}
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Ver Todas
            </button>
          </div>
          <div className="space-y-4">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                    t.type === 'income' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  )}>
                    {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-stone-900 dark:text-stone-50 text-sm truncate">{t.description || t.category}</h4>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400">{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <span className={cn(
                  "font-bold text-sm shrink-0",
                  t.type === 'income' ? "text-emerald-600" : "text-red-600"
                )}>
                  {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center text-stone-400 py-8 italic">Nenhuma transação recente</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Próximos Pagamentos</h3>
            <button 
              onClick={() => onNavigate('reminders')}
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Ver Todos
            </button>
          </div>
          <div className="space-y-4">
            {reminders.filter(r => !r.isPaid).slice(0, 3).map(reminder => (
              <div key={reminder.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white dark:bg-stone-800 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-stone-900 dark:text-stone-50 text-sm truncate">{reminder.title}</h4>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400">{format(parseISO(reminder.dueDate), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <span className="font-bold text-stone-900 dark:text-stone-50 text-sm shrink-0">{formatCurrency(reminder.amount)}</span>
              </div>
            ))}
            {reminders.filter(r => !r.isPaid).length === 0 && (
              <p className="text-center text-stone-400 py-8">Nenhum lembrete pendente</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Metas do Mês</h3>
            <button 
              onClick={() => onNavigate('goals')}
              className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Ver Todas
            </button>
          </div>
          <div className="space-y-6">
            {goals.filter(g => g.month === currentMonth).slice(0, 3).map(goal => {
              const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-stone-900 dark:text-stone-50">{goal.title}</span>
                    <span className="text-stone-500 dark:text-stone-400">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
            {goals.filter(g => g.month === currentMonth).length === 0 && (
              <p className="text-center text-stone-400 py-8">Nenhuma meta definida para este mês</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, color, trend }: { title: string, value: number, icon: React.ReactNode, color: 'emerald' | 'blue' | 'red' | 'violet', trend?: 'up' | 'down' }) {
  const colorClasses = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    red: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400"
  };

  return (
    <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm flex items-center gap-5 transition-colors">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", colorClasses[color])}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-bold text-stone-900 dark:text-stone-50">{formatCurrency(value)}</h4>
          {trend && (
            <span className={cn("text-xs font-bold", trend === 'up' ? "text-emerald-500" : "text-red-500")}>
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void; 
}) {
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div key="confirm-dialog-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <motion.div 
            key="confirm-dialog-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden transition-colors p-6"
          >
            <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50 mb-2">{title}</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-6">{message}</p>
            <div className="flex gap-3">
              <button 
                onClick={onCancel}
                className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={onConfirm}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-100 dark:shadow-none"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Transactions({ transactions, user, isLoading }: { transactions: Transaction[], user: User, isLoading?: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const categories = {
    expense: ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Outros'],
    income: ['Salário', 'Investimentos', 'Freelance', 'Presente', 'Outros']
  };

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingId(transaction.id || null);
      setFormData({
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        description: transaction.description,
        date: transaction.date
      });
    } else {
      setEditingId(null);
      setFormData({
        amount: 0,
        type: 'expense',
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0 || !formData.category) return;

    const transactionData: Omit<Transaction, 'id'> = {
      uid: user.uid,
      amount: formData.amount,
      type: formData.type,
      category: formData.category,
      description: formData.description,
      date: formData.date,
      month: format(parseISO(formData.date), 'yyyy-MM')
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), transactionData);
      } else {
        await addDoc(collection(db, 'transactions'), transactionData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setFormData({
        amount: 0,
        type: 'expense',
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const deleteTransaction = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'transactions', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (!startDate && !endDate) return true;
    const tDate = t.date;
    if (startDate && tDate < startDate) return false;
    if (endDate && tDate > endDate) return false;
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Excluir Transação"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        onConfirm={deleteTransaction}
        onCancel={() => setItemToDelete(null)}
      />

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            key="success-toast"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 z-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Transação salva com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Transações</h2>
          <p className="text-stone-500 dark:text-stone-400">Gerencie suas entradas e saídas</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
          Nova Transação
        </button>
      </header>

      <div className="bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col md:flex-row md:items-center gap-4 overflow-hidden transition-colors">
        <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 shrink-0">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-bold">Filtrar por período:</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-w-0 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-1.5 py-2 text-[11px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-stone-50"
            />
          </div>
          <span className="text-stone-400 text-[10px] sm:text-sm px-0.5">até</span>
          <div className="min-w-0">
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-w-0 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-1.5 py-2 text-[11px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-stone-50"
            />
          </div>
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-red-500 transition-colors self-end md:self-auto shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar Filtros
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400">Data</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400">Descrição</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400">Categoria</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 text-right">Valor</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              <AnimatePresence initial={false}>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-48"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 bg-stone-200 dark:bg-stone-700 rounded-full w-20"></div>
                      </td>
                      <td className="px-6 py-4 flex justify-end">
                        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-8 bg-stone-200 dark:bg-stone-700 rounded-xl w-20 mx-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredTransactions.map((t) => (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      layout
                      className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors"
                    >
                    <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                      {format(parseISO(t.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-50">{t.description || 'Sem descrição'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold rounded-full">
                        {t.category}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm font-bold text-right",
                      t.type === 'income' ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"
                    )}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenModal(t)} 
                          className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => t.id && setItemToDelete(t.id)} 
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
                )}
              </AnimatePresence>
              {!isLoading && filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">
                    {transactions.length === 0 
                      ? "Nenhuma transação encontrada." 
                      : "Nenhuma transação encontrada no período selecionado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div key="transaction-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              key="transaction-modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{editingId ? 'Editar Transação' : 'Nova Transação'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-all">
                  <X className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                      formData.type === 'expense' ? "bg-white dark:bg-stone-700 text-red-600 dark:text-red-400 shadow-sm" : "text-stone-500 dark:text-stone-400"
                    )}
                  >
                    Despesa
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                      formData.type === 'income' ? "bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-stone-500 dark:text-stone-400"
                    )}
                  >
                    Receita
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Valor</label>
                  <CurrencyInput 
                    value={formData.amount} 
                    onChange={(val) => setFormData({ ...formData, amount: val })} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Categoria</label>
                  <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-stone-50">
                    <option value="">Selecione uma categoria</option>
                    {categories[formData.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Data</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-stone-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Descrição</label>
                  <input type="text" maxLength={200} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-stone-50" placeholder="Ex: Aluguel, Supermercado..." />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none mt-4">
                  {editingId ? 'Salvar Alterações' : 'Salvar Transação'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Goals({ goals, user }: { goals: Goal[], user: User }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    targetAmount: 0,
    currentAmount: 0,
    category: 'Geral',
    month: format(new Date(), 'yyyy-MM')
  });

  const handleOpenModal = (goal?: Goal) => {
    if (goal) {
      setEditingId(goal.id || null);
      setFormData({
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        category: goal.category,
        month: goal.month
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        targetAmount: 0,
        currentAmount: 0,
        category: 'Geral',
        month: format(new Date(), 'yyyy-MM')
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || formData.targetAmount <= 0) return;

    const goalData: Omit<Goal, 'id'> = {
      uid: user.uid,
      title: formData.title,
      targetAmount: formData.targetAmount,
      currentAmount: formData.currentAmount,
      category: formData.category,
      month: formData.month
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'goals', editingId), goalData);
      } else {
        await addDoc(collection(db, 'goals'), goalData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        title: '',
        targetAmount: 0,
        currentAmount: 0,
        category: 'Geral',
        month: format(new Date(), 'yyyy-MM')
      });
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const updateGoalProgress = async (goal: Goal, amount: number) => {
    if (!goal.id) return;
    try {
      await updateDoc(doc(db, 'goals', goal.id), { currentAmount: goal.currentAmount + amount });
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const deleteGoal = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'goals', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Excluir Meta"
        message="Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita."
        onConfirm={deleteGoal}
        onCancel={() => setItemToDelete(null)}
      />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Metas Mensais</h2>
          <p className="text-stone-500 dark:text-stone-400">Defina e acompanhe seus objetivos financeiros</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none">
          <Plus className="w-5 h-5" /> Nova Meta
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          return (
            <div key={goal.id} className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm space-y-4 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">{goal.title}</h3>
                  <p className="text-xs text-stone-400 font-bold uppercase">{goal.month}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleOpenModal(goal)} 
                    className="p-2 text-stone-300 dark:text-stone-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => goal.id && setItemToDelete(goal.id)} 
                    className="p-2 text-stone-300 dark:text-stone-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Progresso</span>
                  <span className="font-bold text-stone-900 dark:text-stone-50">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-3 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={cn("h-full rounded-full", progress >= 100 ? "bg-emerald-500" : "bg-blue-500")} />
                </div>
                <div className="flex justify-between text-xs font-medium text-stone-400 dark:text-stone-500">
                  <span>{formatCurrency(goal.currentAmount)}</span>
                  <span>{formatCurrency(goal.targetAmount)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {[10, 50, 100].map(amt => (
                  <button key={amt} onClick={() => updateGoalProgress(goal, amt)} className="flex-1 min-w-[60px] py-2 bg-stone-50 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold rounded-xl transition-all border border-stone-100 dark:border-stone-700">
                    + R$ {amt}
                  </button>
                ))}
                <button 
                  onClick={() => handleOpenModal(goal)}
                  className="flex-1 min-w-[80px] py-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl transition-all border border-emerald-100 dark:border-emerald-800"
                >
                  Ajustar
                </button>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-stone-900 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 transition-colors">
            <Target className="w-12 h-12 text-stone-200 dark:text-stone-800 mx-auto mb-4" />
            <p className="text-stone-400 dark:text-stone-500">Nenhuma meta definida ainda.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div key="goal-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              key="goal-modal-content"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{editingId ? 'Editar Meta' : 'Nova Meta'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-all"><X className="w-5 h-5 text-stone-500 dark:text-stone-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Título da Meta</label>
                  <input type="text" maxLength={100} required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-stone-50" placeholder="Ex: Reserva de Emergência" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Valor Alvo</label>
                    <CurrencyInput 
                      value={formData.targetAmount} 
                      onChange={(val) => setFormData({ ...formData, targetAmount: val })} 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Valor Atual</label>
                    <CurrencyInput 
                      value={formData.currentAmount} 
                      onChange={(val) => setFormData({ ...formData, currentAmount: val })} 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Mês de Referência</label>
                  <input type="month" required value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-stone-50" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none mt-4">
                  {editingId ? 'Salvar Alterações' : 'Criar Meta'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NotificationPanel({ 
  isOpen, 
  onClose, 
  notifications, 
  onMarkAsRead, 
  onClearAll,
  align = 'right'
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  notifications: AppNotification[],
  onMarkAsRead: (id: string) => void,
  onClearAll: () => void,
  align?: 'left' | 'right'
}) {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="notification-panel-wrapper">
          <div key="notification-panel-overlay" className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div 
            key="notification-panel-content"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              "z-50 overflow-hidden bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-100 dark:border-stone-800 transition-colors",
              // Mobile: Fixed position, centered at the top
              "fixed top-20 left-4 right-4 w-auto md:absolute md:top-full md:mt-2 md:w-80 md:left-auto md:right-auto",
              align === 'right' ? "md:right-0" : "md:left-0"
            )}
          >
            <div className="p-4 border-b border-stone-50 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/50">
              <h3 className="font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                Notificações
                {unreadCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">
                    {unreadCount} novas
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button 
                  onClick={onClearAll}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
                >
                  Ler todas
                </button>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-stone-50 dark:divide-stone-800">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => {
                        if (notification.id) onMarkAsRead(notification.id);
                      }}
                      className={cn(
                        "w-full p-4 text-left transition-all hover:bg-stone-50 dark:hover:bg-stone-800 flex gap-3",
                        !notification.isRead && "bg-emerald-50/30 dark:bg-emerald-900/10"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        notification.type === 'reminder' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      )}>
                        {notification.type === 'reminder' ? <Calendar className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm font-bold truncate", !notification.isRead ? "text-stone-900 dark:text-stone-50" : "text-stone-500 dark:text-stone-400")}>
                            {notification.title}
                          </p>
                          {!notification.isRead && <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-2">
                          {format(parseISO(notification.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 text-stone-200 dark:text-stone-800 mx-auto mb-3" />
                  <p className="text-sm text-stone-400 dark:text-stone-500">Nenhuma notificação por aqui.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Reminders({ reminders, user }: { reminders: Reminder[], user: User }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', amount: 0, dueDate: format(new Date(), 'yyyy-MM-dd') });

  const handleOpenModal = (reminder?: Reminder) => {
    if (reminder) {
      setEditingId(reminder.id || null);
      setFormData({
        title: reminder.title,
        amount: reminder.amount,
        dueDate: reminder.dueDate
      });
    } else {
      setEditingId(null);
      setFormData({ title: '', amount: 0, dueDate: format(new Date(), 'yyyy-MM-dd') });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || formData.amount <= 0) return;
    
    const reminderData: Omit<Reminder, 'id'> = { 
      uid: user.uid, 
      title: formData.title, 
      amount: formData.amount, 
      dueDate: formData.dueDate, 
      isPaid: editingId ? reminders.find(r => r.id === editingId)?.isPaid || false : false 
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'reminders', editingId), reminderData);
      } else {
        await addDoc(collection(db, 'reminders'), reminderData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ title: '', amount: 0, dueDate: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      console.error('Error saving reminder:', error);
    }
  };

  const togglePaid = async (reminder: Reminder) => {
    if (!reminder.id) return;
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), { isPaid: !reminder.isPaid });
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

  const deleteReminder = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'reminders', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Excluir Lembrete"
        message="Tem certeza que deseja excluir este lembrete? Esta ação não pode ser desfeita."
        onConfirm={deleteReminder}
        onCancel={() => setItemToDelete(null)}
      />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Lembretes</h2>
          <p className="text-stone-500 dark:text-stone-400">Nunca mais esqueça de pagar uma conta</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none">
          <Plus className="w-5 h-5" /> Novo Lembrete
        </button>
      </header>
      <div className="space-y-4">
        {reminders.map((reminder) => {
          const isOverdue = isBefore(parseISO(reminder.dueDate), new Date()) && !reminder.isPaid;
          return (
            <div key={reminder.id} className={cn(
              "p-5 rounded-3xl border transition-all flex items-center justify-between group", 
              reminder.isPaid 
                ? "bg-stone-50/50 dark:bg-stone-800/30 opacity-60 border-stone-100 dark:border-stone-800" 
                : isOverdue 
                  ? "bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-900/30" 
                  : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm dark:shadow-none"
            )}>
              <div className="flex items-center gap-5">
                <button onClick={() => togglePaid(reminder)} className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all", 
                  reminder.isPaid 
                    ? "bg-emerald-500 text-white" 
                    : "border-2 border-stone-200 dark:border-stone-700 text-stone-200 dark:text-stone-600 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-500"
                )}>
                  {reminder.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>
                <div>
                  <h3 className={cn("font-bold text-stone-900 dark:text-stone-50", reminder.isPaid && "line-through text-stone-400 dark:text-stone-600")}>{reminder.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn("text-xs font-bold flex items-center gap-1", isOverdue ? "text-red-500 dark:text-red-400" : "text-stone-400 dark:text-stone-500")}>
                      <Calendar className="w-3 h-3" /> {format(parseISO(reminder.dueDate), 'dd/MM/yyyy')}
                    </span>
                    <span className="text-xs font-bold text-stone-400 dark:text-stone-600">•</span>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-50">{formatCurrency(reminder.amount)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => handleOpenModal(reminder)} 
                  className="p-2 text-stone-300 dark:text-stone-600 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                  title="Editar"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => reminder.id && setItemToDelete(reminder.id)} 
                  className="p-2 text-stone-300 dark:text-stone-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  title="Excluir"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
        {reminders.length === 0 && (
          <div className="py-20 text-center bg-white dark:bg-stone-900 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
            <Bell className="w-12 h-12 text-stone-200 dark:text-stone-800 mx-auto mb-4" />
            <p className="text-stone-400 dark:text-stone-500">Nenhum lembrete cadastrado.</p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-transparent dark:border-stone-800">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{editingId ? 'Editar Lembrete' : 'Novo Lembrete'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-all"><X className="w-5 h-5 text-stone-500 dark:text-stone-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Título da Conta</label>
                  <input type="text" maxLength={100} required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" placeholder="Ex: Conta de Luz" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Valor</label>
                  <CurrencyInput 
                    value={formData.amount} 
                    onChange={(val) => setFormData({ ...formData, amount: val })} 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Data de Vencimento</label>
                  <input type="date" required value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none mt-4">
                  {editingId ? 'Salvar Alterações' : 'Criar Lembrete'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Investments({ 
  assets, 
  dividends, 
  user, 
  isLoading,
  marketPrices,
  isUpdatingPrices,
  updatingTickers,
  isInitialLoadingPrices,
  checkedTickers,
  updatePrices
}: { 
  assets: Asset[], 
  dividends: Dividend[], 
  user: User, 
  isLoading?: boolean,
  marketPrices: Record<string, number>,
  isUpdatingPrices: boolean,
  updatingTickers: Set<string>,
  isInitialLoadingPrices: boolean,
  checkedTickers: React.MutableRefObject<Set<string>>,
  updatePrices: (force?: boolean) => Promise<void>
}) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Asset State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ticker: '',
    quantity: 0,
    type: 'Ação' as Asset['type']
  });

  // Dividend State
  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [dividendEditingId, setDividendEditingId] = useState<string | null>(null);
  const [dividendItemToDelete, setDividendItemToDelete] = useState<string | null>(null);
  const [dividendFormData, setDividendFormData] = useState({
    ticker: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: 0,
    valuePerShare: 0
  });

  const types: Asset['type'][] = ['Ação', 'FII', 'Renda Fixa', 'Cripto', 'Outros'];

  const handleOpenDividendModal = (dividend?: Dividend) => {
    if (dividend) {
      setDividendEditingId(dividend.id || null);
      setDividendFormData({
        ticker: dividend.ticker,
        date: dividend.date,
        quantity: dividend.quantity,
        valuePerShare: dividend.valuePerShare
      });
    } else {
      setDividendEditingId(null);
      setDividendFormData({
        ticker: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        quantity: 0,
        valuePerShare: 0
      });
    }
    setIsDividendModalOpen(true);
  };

  const handleDividendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dividendFormData.ticker || dividendFormData.quantity <= 0) return;

    const dividendData: Omit<Dividend, 'id'> = {
      uid: user.uid,
      ticker: dividendFormData.ticker.toUpperCase(),
      date: dividendFormData.date,
      month: format(parseISO(dividendFormData.date), 'yyyy-MM'),
      quantity: dividendFormData.quantity,
      valuePerShare: dividendFormData.valuePerShare,
      total: dividendFormData.quantity * dividendFormData.valuePerShare
    };

    try {
      if (dividendEditingId) {
        await updateDoc(doc(db, 'dividends', dividendEditingId), dividendData);
      } else {
        await addDoc(collection(db, 'dividends'), dividendData);
      }
      setIsDividendModalOpen(false);
      setDividendEditingId(null);
    } catch (error) {
      console.error('Error saving dividend:', error);
    }
  };

  const deleteDividend = async () => {
    if (!dividendItemToDelete) return;
    try {
      await deleteDoc(doc(db, 'dividends', dividendItemToDelete));
      setDividendItemToDelete(null);
    } catch (error) {
      console.error('Error deleting dividend:', error);
    }
  };

  const handleOpenModal = (asset?: Asset) => {
    if (asset) {
      setEditingId(asset.id || null);
      setFormData({
        ticker: asset.ticker,
        quantity: asset.quantity,
        type: asset.type
      });
    } else {
      setEditingId(null);
      setFormData({
        ticker: '',
        quantity: 0,
        type: 'Ação'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ticker || formData.quantity <= 0) return;

    const assetData: Omit<Asset, 'id'> = {
      uid: user.uid,
      ticker: formData.ticker.toUpperCase(),
      quantity: formData.quantity,
      type: formData.type
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'assets', editingId), assetData);
      } else {
        await addDoc(collection(db, 'assets'), assetData);
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `assets/${editingId}` : 'assets');
    }
  };

  const deleteAsset = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'assets', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const currentBalance = assets.reduce((acc, asset) => acc + (asset.quantity * (marketPrices[asset.ticker.toUpperCase()] || 0)), 0);

  const monthDividends = dividends.filter(d => d.month === selectedMonth);
  const totalMonthDividends = monthDividends.reduce((acc, d) => acc + d.total, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Excluir Ativo"
        message="Tem certeza que deseja excluir este ativo? Esta ação não pode ser desfeita."
        onConfirm={deleteAsset}
        onCancel={() => setItemToDelete(null)}
      />
      <ConfirmDialog 
        isOpen={!!dividendItemToDelete}
        title="Excluir Provento"
        message="Tem certeza que deseja excluir este provento? Esta ação não pode ser desfeita."
        onConfirm={deleteDividend}
        onCancel={() => setDividendItemToDelete(null)}
      />
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Minha Carteira</h2>
          <p className="text-stone-500 dark:text-stone-400">Acompanhe seus ativos e proventos mensais</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const d = parseISO(`${selectedMonth}-01`);
              d.setMonth(d.getMonth() - 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-all text-stone-600 dark:text-stone-300"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-stone-900 dark:text-stone-50 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button 
            onClick={() => {
              const d = parseISO(`${selectedMonth}-01`);
              d.setMonth(d.getMonth() + 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-all text-stone-600 dark:text-stone-300"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Saldo Atual</p>
              <h3 className="text-2xl font-black text-stone-900 dark:text-stone-50">
                {isUpdatingPrices ? (
                  <div className="h-8 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-32"></div>
                ) : (
                  formatCurrency(currentBalance)
                )}
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Proventos ({format(parseISO(`${selectedMonth}-01`), 'MMMM', { locale: ptBR })})</p>
              <h3 className="text-2xl font-black text-stone-900 dark:text-stone-50">{formatCurrency(totalMonthDividends)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => handleOpenModal()} className="bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-50 font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2">
              <Plus className="w-5 h-5" /> Novo Ativo
            </button>
            {isUpdatingPrices && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider animate-pulse flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando cotações...
              </span>
            )}
          </div>
          <button onClick={() => handleOpenDividendModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none">
            <Plus className="w-5 h-5" /> Novo Provento
          </button>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Ativo</th>
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Tipo</th>
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-right">Qtd. Atual</th>
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-right">Preço</th>
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-right">Saldo</th>
                  <th className="p-4 text-xs font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider text-right">Qtd. Prov.</th>
                  <th className="p-4 text-xs font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider text-right">Prov./Cota</th>
                  <th className="p-4 text-xs font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider text-right">Total Prov.</th>
                  <th className="p-4 text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b border-stone-50 dark:border-stone-800/50">
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-20"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-16"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-12 ml-auto"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-20 ml-auto"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-20 ml-auto"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-16 ml-auto"></div></td>
                      <td className="p-4"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-16 ml-auto"></div></td>
                      <td className="p-4"><div className="h-8 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-16 mx-auto"></div></td>
                    </tr>
                  ))
                ) : (
                  (() => {
                    const monthDivs = dividends.filter(d => d.month === selectedMonth);
                    const allTickers = Array.from(new Set([
                      ...assets.map(a => a.ticker.toUpperCase()),
                      ...monthDivs.map(d => d.ticker.toUpperCase())
                    ])).sort();

                    if (allTickers.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-stone-500 dark:text-stone-400">
                            Nenhum ativo ou provento cadastrado.
                          </td>
                        </tr>
                      );
                    }

                    return allTickers.map(ticker => {
                      const asset = assets.find(a => a.ticker.toUpperCase() === ticker);
                      const tickerMonthDivs = monthDivs.filter(d => d.ticker.toUpperCase() === ticker);
                      const totalDiv = tickerMonthDivs.reduce((acc, d) => acc + d.total, 0);
                      const divPerShare = tickerMonthDivs.length > 0 ? tickerMonthDivs[0].valuePerShare : 0;
                      const divQuantity = tickerMonthDivs.length > 0 ? tickerMonthDivs[0].quantity : 0;
                      
                      const currentPrice = marketPrices[ticker] || 0;
                      const currentBalance = asset ? currentPrice * asset.quantity : 0;
                      const isUpdating = updatingTickers.has(ticker);
                      const isInitialLoading = isInitialLoadingPrices && !(ticker in marketPrices);

                      return (
                        <tr key={ticker} className="border-b border-stone-50 dark:border-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
                          <td className="p-4 font-bold text-stone-900 dark:text-stone-50">{ticker}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg text-xs font-bold">
                              {asset?.type || '-'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-medium text-stone-900 dark:text-stone-50">
                            {asset ? asset.quantity : <span className="text-stone-400 italic">0</span>}
                          </td>
                          <td className="p-4 text-right font-medium text-stone-900 dark:text-stone-50">
                            {asset ? (
                              isInitialLoading || isUpdating ? (
                                <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-16 ml-auto"></div>
                              ) : currentPrice > 0 ? (
                                <div className="flex items-center justify-end gap-1">
                                  <span>{formatCurrency(currentPrice)}</span>
                                  {isUpdatingPrices && checkedTickers.current.has(ticker) && (
                                    <RefreshCw className="w-3 h-3 text-stone-400 animate-spin" />
                                  )}
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">N/A</span>
                              )
                            ) : '-'}
                          </td>
                          <td className="p-4 text-right font-bold text-stone-900 dark:text-stone-50">
                            {asset ? (
                              isInitialLoading || isUpdating ? (
                                <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse w-20 ml-auto"></div>
                              ) : currentBalance > 0 ? (
                                formatCurrency(currentBalance)
                              ) : (
                                <span className="text-stone-400 italic">N/A</span>
                              )
                            ) : '-'}
                          </td>
                          <td className="p-4 text-right font-medium text-violet-600 dark:text-violet-400">
                            {divQuantity > 0 ? divQuantity : '-'}
                          </td>
                          <td className="p-4 text-right font-medium text-violet-600 dark:text-violet-400">
                            {divPerShare > 0 ? formatCurrency(divPerShare, 4) : '-'}
                          </td>
                          <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {totalDiv > 0 ? formatCurrency(totalDiv) : '-'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              {asset && (
                                <button 
                                  onClick={() => handleOpenModal(asset)}
                                  className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                                  title="Editar Ativo"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {tickerMonthDivs.length > 0 ? (
                                <button 
                                  onClick={() => handleOpenDividendModal(tickerMonthDivs[0])}
                                  className="p-2 text-stone-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all"
                                  title="Editar Provento"
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setDividendEditingId(null);
                                    setDividendFormData({
                                      ticker: ticker,
                                      date: format(new Date(), 'yyyy-MM-dd'),
                                      quantity: asset?.quantity || 0,
                                      valuePerShare: 0
                                    });
                                    setIsDividendModalOpen(true);
                                  }}
                                  className="p-2 text-stone-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all"
                                  title="Lançar Provento"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                              {asset && (
                                <button 
                                  onClick={() => asset.id && setItemToDelete(asset.id)}
                                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                  title="Excluir Ativo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Dica:</span> Os proventos são calculados com base na sua posição na <span className="font-bold">Data de Corte (Data Com)</span>. Esta é a data limite em que você precisava ter o ativo para ter direito a receber este pagamento.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div key="asset-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              key="asset-modal-content"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-transparent dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{editingId ? 'Editar Ativo' : 'Novo Ativo'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-all"><X className="w-5 h-5 text-stone-500 dark:text-stone-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Ticker</label>
                  <input type="text" maxLength={10} required value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50 uppercase" placeholder="Ex: PETR4" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Tipo</label>
                  <select required value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Asset['type'] })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50">
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Quantidade</label>
                    <input type="number" min="0" step="0.01" required value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none mt-4">
                  {editingId ? 'Salvar Alterações' : 'Adicionar Ativo'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isDividendModalOpen && (
          <div key="dividend-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              key="dividend-modal-content"
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-transparent dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{dividendEditingId ? 'Editar Provento' : 'Novo Provento'}</h3>
                <button onClick={() => setIsDividendModalOpen(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-all"><X className="w-5 h-5 text-stone-500 dark:text-stone-400" /></button>
              </div>
              <form onSubmit={handleDividendSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Ticker</label>
                    <input type="text" maxLength={10} required value={dividendFormData.ticker} onChange={(e) => setDividendFormData({ ...dividendFormData, ticker: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50 uppercase" placeholder="Ex: PETR4" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Data de Pagamento</label>
                    <input type="date" required value={dividendFormData.date} onChange={(e) => setDividendFormData({ ...dividendFormData, date: e.target.value })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Cotas com Direito</label>
                    <input type="number" min="0" step="0.01" required value={dividendFormData.quantity || ''} onChange={(e) => setDividendFormData({ ...dividendFormData, quantity: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-stone-900 dark:text-stone-50" />
                    <p className="text-[10px] text-stone-400">Quantidade que você tinha na Data Com</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Valor por Cota</label>
                    <CurrencyInput 
                      value={dividendFormData.valuePerShare} 
                      onChange={(val) => setDividendFormData({ ...dividendFormData, valuePerShare: val })} 
                      decimals={4}
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Total</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(dividendFormData.quantity * dividendFormData.valuePerShare)}
                  </span>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none mt-4">
                  {dividendEditingId ? 'Salvar Alterações' : 'Adicionar Provento'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
