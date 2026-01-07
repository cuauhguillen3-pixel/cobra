import { useState } from 'react';
import { Users as UsersIcon, Shield } from 'lucide-react';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';

type TabType = 'users' | 'roles';

export default function Users() {
  const [activeTab, setActiveTab] = useState<TabType>('users');

  const tabs = [
    { id: 'users' as TabType, label: 'Usuarios', icon: UsersIcon },
    { id: 'roles' as TabType, label: 'Roles y Permisos', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Gestión de Usuarios</h2>
        <p className="text-gray-400">Administra usuarios, roles y permisos del sistema</p>
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
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'roles' && <RoleManagement />}
        </div>
      </div>
    </div>
  );
}
