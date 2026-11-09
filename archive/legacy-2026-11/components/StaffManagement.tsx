/**
 * Gestion du Personnel Component
 * 
 * Gestion des employés, laveurs et commissions pour les stations de lavage.
 * 
 * Features:
 * - Ajout d'employé via formulaire modal
 * - Sélecteur de rôle (laveur/caissier/gerant)
 * - Taux de commission configurable
 * - Liste des membres avec suivi des lavages et commissions
 * - Systeme d'invitations (création et annulation)
 * - Révocation d'accès membre
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Plus, Award, DollarSign, Phone, ShieldCheck, X } from 'lucide-react';
import { UserRole } from '../types';

export const StaffManagement: React.FC = () => {
  const { employees, addEmployee, formatCurrency } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [role, setRole] = useState<UserRole>('laveur');
  const [commissionRate, setCommissionRate] = useState('15');

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    addEmployee({
      tenantId: 'tenant-1',
      name,
      phone,
      role,
      commissionRate: Number(commissionRate) || 15,
      status: 'active',
    });
    setName('');
    setPhone('+225 ');
    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Personnel, Laveurs & Commissions</span>
          </h2>
          <p className="text-xs text-gray-400">
            Fiches employés, rôles d'accès, suivi des lavages effectués et primes/commissions automatiques
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>+ Ajouter un Employé</span>
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {employees.map(emp => {
          const isWasher = emp.role === 'laveur';
          return (
            <div
              key={emp.id}
              className="bg-[#1c202a] border border-[#272d3b] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={emp.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'}
                    alt={emp.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-cyan-500/30"
                  />
                  <div>
                    <h4 className="font-bold text-white text-sm">{emp.name}</h4>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#262c3a] text-cyan-300">
                      {emp.role}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{emp.phone}</span>
                  </div>
                  {isWasher && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>Taux commission : <strong className="text-white">{emp.commissionRate}%</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              {isWasher ? (
                <div className="pt-3 border-t border-[#272d3b] grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#222734] p-2 rounded-xl text-center">
                    <span className="text-[10px] text-gray-400 block">LAVAGES</span>
                    <span className="font-extrabold text-white text-sm block mt-0.5">
                      {emp.totalWashesCompleted}
                    </span>
                  </div>

                  <div className="bg-[#222734] p-2 rounded-xl text-center">
                    <span className="text-[10px] text-gray-400 block">COMMISSIONS</span>
                    <span className="font-extrabold text-emerald-400 text-xs block mt-0.5">
                      {emp.totalCommissionsEarned.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-[#272d3b] text-center text-xs text-gray-400 py-2">
                  Poste de supervision & gestion
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Ajouter un Membre du Personnel</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom et Prénom</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Kouamé Jean"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+225 07..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="laveur">Laveur</option>
                    <option value="caissier">Caissier</option>
                    <option value="gerant">Gérant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Commission (%)</label>
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={e => setCommissionRate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-md"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
