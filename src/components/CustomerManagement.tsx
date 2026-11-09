import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Search, Plus, Phone, Mail, Award, Car, MessageCircle, X } from 'lucide-react';

export const CustomerManagement: React.FC = () => {
  const { customers, addCustomer, formatCurrency, orders } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer({
      tenantId: 'tenant-1',
      name,
      phone,
      email: email || undefined,
      notes: notes || undefined,
    });
    setName('');
    setPhone('+225 ');
    setEmail('');
    setNotes('');
    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Gestion de la Clientèle & Flottes</span>
          </h2>
          <p className="text-xs text-gray-400">
            Fiches clients, fidélité, historiques de lavage et contact direct WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher client, téléphone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* Grid of Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCustomers.map(cust => {
          const clientOrders = orders.filter(o => o.customerPhone === cust.phone || o.customerName === cust.name);
          return (
            <div
              key={cust.id}
              className="bg-[#1c202a] border border-[#272d3b] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
                      {cust.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{cust.name}</h4>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        {cust.phone}
                      </span>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Envoyer un message WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </div>

                {cust.email && (
                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-2">
                    <Mail className="w-3 h-3" />
                    <span>{cust.email}</span>
                  </div>
                )}

                {cust.notes && (
                  <p className="text-xs text-gray-400 bg-[#222734] p-2.5 rounded-xl border border-[#2c3343] mt-3">
                    {cust.notes}
                  </p>
                )}
              </div>

              {/* Stats: visits & total spent */}
              <div className="pt-3 border-t border-[#272d3b] grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#222734] p-2 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">VISITES EFFECTUÉES</span>
                  <span className="font-extrabold text-white text-sm flex items-center gap-1 mt-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    {cust.totalVisits + clientOrders.length} lavages
                  </span>
                </div>

                <div className="bg-[#222734] p-2 rounded-xl">
                  <span className="text-gray-400 text-[10px] block">TOTAL DÉPENSÉ</span>
                  <span className="font-extrabold text-cyan-400 text-sm mt-0.5 block">
                    {formatCurrency(cust.totalSpent)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Nouveau Client</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Complet</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Yao Michel"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Téléphone (avec indicatif +225)</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+225 07..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email (Facultatif)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="client@domaine.ci"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Préférences / Remarques</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Véhicule habituel, formule préférée..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
