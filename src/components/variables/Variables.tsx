import { useState } from 'react';
import { Percent, AlertCircle, RefreshCw } from 'lucide-react';
import InterestRates from './InterestRates';
import LatePaymentFees from './LatePaymentFees';
import RenewalFees from './RenewalFees';

type TabType = 'interest' | 'late_fees' | 'renewal_fees';

export default function Variables() {
  const [activeTab, setActiveTab] = useState<TabType>('interest');

  const tabs = [
    { id: 'interest' as TabType, label: 'Tasas de Interés', icon: Percent },
    { id: 'late_fees' as TabType, label: 'Cuotas de Morosidad', icon: AlertCircle },
    { id: 'renewal_fees' as TabType, label: 'Cuotas de Renovación', icon: RefreshCw }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Variables</h2>
        <p className="text-gray-400">Gestiona tasas de interés, cuotas de morosidad y renovación</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-750'
                }`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'interest' && <InterestRates />}
          {activeTab === 'late_fees' && <LatePaymentFees />}
          {activeTab === 'renewal_fees' && <RenewalFees />}
        </div>
      </div>
    </div>
  );
}
