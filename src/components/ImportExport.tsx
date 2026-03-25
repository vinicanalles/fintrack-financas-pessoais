import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileSpreadsheet,
  TrendingUp,
  Wallet,
  ChevronLeft,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { db, collection, addDoc } from '../firebase';
import { Transaction, Asset } from '../types';
import { User } from 'firebase/auth';
import { format, parse, isValid } from 'date-fns';

interface ImportExportProps {
  user: User;
  onComplete: () => void;
}

type Step = 'select' | 'upload' | 'map' | 'processing' | 'success';

export function ImportExport({ user, onComplete }: ImportExportProps) {
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'transactions' | 'assets'>('transactions');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transactionFields = [
    { id: 'date', label: 'Data', description: 'Data da transação (ex: 2024-03-20)' },
    { id: 'description', label: 'Descrição', description: 'Nome ou detalhe da transação' },
    { id: 'amount', label: 'Valor', description: 'Valor numérico (ex: 150.50)' },
    { id: 'type', label: 'Tipo', description: 'Entrada (income) ou Saída (expense)' },
    { id: 'category', label: 'Categoria', description: 'Ex: Alimentação, Salário, etc.' },
  ];

  const assetFields = [
    { id: 'ticker', label: 'Ticker', description: 'Código do ativo (ex: PETR4)' },
    { id: 'quantity', label: 'Quantidade', description: 'Número de cotas/ações' },
    { id: 'type', label: 'Tipo', description: 'Ação, FII, Renda Fixa, etc.' },
  ];

  const currentFields = importType === 'transactions' ? transactionFields : assetFields;

  const parseExcelDate = (value: any): string => {
    if (!value) return format(new Date(), 'yyyy-MM-dd');
    
    // If it's already a Date object (xlsx with cellDates: true)
    if (value instanceof Date && isValid(value)) {
      return format(value, 'yyyy-MM-dd');
    }

    // If it's already a string in YYYY-MM-DD format
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // If it's an Excel serial number
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + value * 86400000);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    }

    // Try parsing common formats
    const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd', 'dd-MM-yyyy'];
    for (const f of formats) {
      const parsed = parse(String(value), f, new Date());
      if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
    }

    return format(new Date(), 'yyyy-MM-dd');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          throw new Error('O arquivo está vazio.');
        }

        const fileHeaders = Object.keys(data[0] as object);
        setHeaders(fileHeaders);
        setRawData(data);
        
        // Try to auto-map
        const newMapping: Record<string, string> = {};
        currentFields.forEach(field => {
          const match = fileHeaders.find(h => 
            h.toLowerCase().includes(field.label.toLowerCase()) || 
            h.toLowerCase().includes(field.id.toLowerCase())
          );
          if (match) newMapping[field.id] = match;
        });
        setMapping(newMapping);
        
        setStep('map');
      } catch (err: any) {
        setError(err.message || 'Erro ao ler o arquivo.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const startImport = async () => {
    // Validate mapping
    const missingFields = currentFields.filter(f => !mapping[f.id]);
    if (missingFields.length > 0 && importType === 'transactions') {
      const critical = ['date', 'amount', 'type'];
      if (missingFields.some(f => critical.includes(f.id))) {
        setError('Por favor, mapeie os campos obrigatórios (Data, Valor e Tipo).');
        return;
      }
    }

    setStep('processing');
    setLoading(true);
    let importedCount = 0;

    try {
      for (const row of rawData) {
        if (importType === 'transactions') {
          const rawDate = row[mapping['date']];
          const dateStr = parseExcelDate(rawDate);
          
          const rawAmount = row[mapping['amount']];
          const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^\d.,-]/g, '').replace(',', '.'));

          const rawType = String(row[mapping['type']] || '').toLowerCase();
          const type = (rawType.includes('receita') || rawType.includes('income') || rawType.includes('entrada')) ? 'income' : 'expense';

          const transaction: Transaction = {
            uid: user.uid,
            date: dateStr,
            description: String(row[mapping['description']] || 'Importado'),
            amount: isNaN(amount) ? 0 : amount,
            type: type as 'income' | 'expense',
            category: String(row[mapping['category']] || 'Outros'),
            month: dateStr.substring(0, 7)
          };
          await addDoc(collection(db, 'transactions'), transaction);
        } else {
          const asset: Asset = {
            uid: user.uid,
            ticker: String(row[mapping['ticker']] || 'UNKNOWN').toUpperCase(),
            quantity: Number(row[mapping['quantity']]) || 0,
            type: (row[mapping['type']] || 'Outros') as any
          };
          await addDoc(collection(db, 'assets'), asset);
        }
        importedCount++;
      }
      setSuccess(`${importedCount} registros importados com sucesso!`);
      setStep('success');
      onComplete();
    } catch (err: any) {
      setError('Erro ao salvar os dados: ' + err.message);
      setStep('map');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div 
            key="select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <header>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">O que vamos importar hoje?</h2>
              <p className="text-stone-500 dark:text-stone-400">Selecione o tipo de dado que você deseja trazer para o FinTrack</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => { setImportType('transactions'); setStep('upload'); }}
                className="group bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm hover:border-emerald-600 transition-all text-left space-y-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">Transações</h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm">Histórico de entradas, saídas e gastos mensais.</p>
                </div>
              </button>

              <button
                onClick={() => { setImportType('assets'); setStep('upload'); }}
                className="group bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm hover:border-emerald-600 transition-all text-left space-y-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Wallet className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">Investimentos</h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm">Sua carteira de ativos, ações, FIIs e criptos.</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {step === 'upload' && (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <button 
              onClick={() => setStep('select')}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>

            <header>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Selecione sua planilha</h2>
              <p className="text-stone-500 dark:text-stone-400">Não se preocupe com o formato, você poderá organizar as colunas no próximo passo.</p>
            </header>

            <div 
              onClick={() => !loading && fileInputRef.current?.click()}
              className={cn(
                "bg-white dark:bg-stone-900 border-2 border-dashed rounded-3xl p-16 flex flex-col items-center gap-6 transition-all cursor-pointer",
                loading ? "opacity-50 cursor-not-allowed" : "hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/5",
                error ? "border-red-300 dark:border-red-900/50" : "border-stone-200 dark:border-stone-800"
              )}
            >
              {loading ? (
                <Loader2 className="w-16 h-16 text-emerald-600 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-16 h-16 text-stone-300 dark:text-stone-700" />
              )}
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-stone-700 dark:text-stone-300">
                  {loading ? 'Lendo arquivo...' : 'Arraste ou clique para enviar'}
                </p>
                <p className="text-sm text-stone-400">Formatos aceitos: .xlsx, .xls, .csv</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {step === 'map' && (
          <motion.div 
            key="map"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Organizar Colunas</h2>
                <p className="text-stone-500 dark:text-stone-400">Relacione as colunas da sua planilha com os campos do FinTrack</p>
              </div>
              <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-bold">
                {rawData.length} registros encontrados
              </div>
            </header>

            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="font-bold text-stone-900 dark:text-stone-50">Campo no FinTrack</div>
                  <div className="font-bold text-stone-900 dark:text-stone-50">Sua Coluna</div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {currentFields.map((field) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-200">{field.label}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{field.description}</p>
                    </div>
                    <select
                      value={mapping[field.id] || ''}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-stone-900 dark:text-stone-50"
                    >
                      <option value="">Selecionar coluna...</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-stone-50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-4">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 text-stone-500 font-bold hover:text-stone-900 dark:hover:text-stone-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={startImport}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Confirmar Importação
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="relative">
              <Loader2 className="w-20 h-20 text-emerald-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileUp className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Importando seus dados...</h3>
              <p className="text-stone-500 dark:text-stone-400">Isso pode levar alguns segundos dependendo do tamanho da sua planilha.</p>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm text-center space-y-8"
          >
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-stone-900 dark:text-stone-50">Tudo pronto!</h3>
              <p className="text-stone-500 dark:text-stone-400 text-lg">{success}</p>
            </div>
            <button
              onClick={() => setStep('select')}
              className="bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900 font-bold py-4 px-10 rounded-2xl hover:opacity-90 transition-all"
            >
              Voltar ao Início
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
