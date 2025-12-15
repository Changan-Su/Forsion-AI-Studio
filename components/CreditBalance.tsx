import React, { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';
import { backendService } from '../services/backendService';

const CreditBalance: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await backendService.getCreditBalance();
        setBalance(bal);
      } catch (error) {
        console.error('Failed to fetch credit balance', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
    
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5">
        <Coins size={16} className="text-gray-400" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-forsion-500/10 to-indigo-500/10 dark:from-forsion-500/20 dark:to-indigo-500/20 border border-forsion-500/20 dark:border-forsion-500/30">
      <Coins size={16} className="text-forsion-600 dark:text-forsion-400" />
      <span className="text-sm font-semibold text-forsion-700 dark:text-forsion-300">
        {balance.toFixed(2)} Credits
      </span>
    </div>
  );
};

export default CreditBalance;


