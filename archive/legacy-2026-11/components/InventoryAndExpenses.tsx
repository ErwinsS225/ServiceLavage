import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, AlertTriangle, Plus, DollarSign, TrendingDown, RefreshCw, X } from 'lucide-react';
import { PaymentMethod } from '../types';

export const InventoryAndExpenses: React.FC = () => {
  const { 
    inventory, 
    expenses, 
    addExpense, 
    addInventoryItem, 
    updateInventoryStock, 
    formatCurrency 
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'expenses'>('inventory');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);

  // New Expense form
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<any>('detergents');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>('wave');

  // New Item form
  const [itemName, setItemName] = useState('');
  const [itemCat, setItemCat] = useState('Produits de lavage');
  const [itemQty, setItemQty] = useState('');
  const [itemUnit, setItemUnit] = useState('Litres');
  const [itemThreshold, setItemThreshold] = useState('10');
  const [itemPrice, setItemPrice] = useState('5000');

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      tenantId: 'tenant-1',
      category: expenseCategory,
      description: expenseDesc,
      amount: Number(expenseAmount) || 0,
      paymentMethod: expensePaymentMethod,
      recordedBy: 'Responsable Station',
    });
    setExpenseDesc('');
    setExpenseAmount('');
    setShowAddExpenseModal(false);
  };

  const handleCreateStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    addInventoryItem({
      tenantId: 'tenant-1',
      name: itemName,
      category: itemCat,
      quantity: Number(itemQty) || 0,
      unit: itemUnit,
      minThreshold: Number(itemThreshold) || 10,
      costPrice: Number(itemPrice) || 0,
    });
    setItemName('');
    setItemQty('');
    setShowAddStockModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            <span>Inventaire Produits & Dépenses Opérationnelles</span>
          </h2>
          <p className="text-xs text-gray-400">
            Suivi des consommables (shampoings, cires, chiffons) et charges d'exploitation de la station
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Subtabs toggle */}
          <div className="flex items-center bg-[#202532] p-1 rounded-xl border border-[#2c3343]">
            <button
              onClick={() => setActiveSubTab('inventory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'inventory' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Stocks ({inventory.length})
            </button>
            <button
              onClick={() => setActiveSubTab('expenses')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'expenses' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Dépenses ({expenses.length})
            </button>
          </div>

          {activeSubTab === 'inventory' ? (
            <button
              onClick={() => setShowAddStockModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ajouter Produit</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>+ Enregistrer Dépense</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {activeSubTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Inventory Table */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                  <th className="pb-3 font-medium">Article / Consommable</th>
                  <th className="pb-3 font-medium">Catégorie</th>
                  <th className="pb-3 font-medium text-center">En Stock</th>
                  <th className="pb-3 font-medium text-center">Seuil d'Alerte</th>
                  <th className="pb-3 font-medium text-right">Coût d'Achat</th>
                  <th className="pb-3 font-medium text-center">État</th>
                  <th className="pb-3 font-medium text-right">Ajuster Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242a38]">
                {inventory.map(item => {
                  const isLow = item.quantity <= item.minThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-[#222734] transition-colors">
                      <td className="py-3">
                        <span className="font-bold text-white text-xs block">{item.name}</span>
                        <span className="text-[10px] text-gray-400">Fournisseur : {item.supplier || 'Local CI'}</span>
                      </td>

                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#262c3a] text-gray-300">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 text-center font-extrabold text-sm text-white">
                        {item.quantity} {item.unit}
                      </td>

                      <td className="py-3 text-center text-gray-400">
                        {item.minThreshold} {item.unit}
                      </td>

                      <td className="py-3 text-right font-semibold text-gray-300">
                        {item.costPrice.toLocaleString('fr-FR')} FCFA
                      </td>

                      <td className="py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          <span>{isLow ? 'Alerte Stock Bas' : 'Normal'}</span>
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateInventoryStock(item.id, Math.max(0, item.quantity - 1))}
                            className="w-7 h-7 rounded bg-[#252b39] hover:bg-[#31394b] text-gray-300 font-bold"
                            title="Diminuer (utilisation)"
                          >
                            -
                          </button>
                          <button
                            onClick={() => updateInventoryStock(item.id, item.quantity + 5)}
                            className="px-2 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-[10px] font-bold"
                            title="Réapprovisionner (+5)"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Expenses banner summary */}
          <div className="p-4 rounded-2xl bg-[#1c202a] border border-[#272d3b] flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-xs block">TOTAL DES DÉPENSES DU MOIS</span>
              <span className="text-2xl font-extrabold text-rose-400">{totalExpenses.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="text-right text-xs text-gray-400">
              {expenses.length} enregistrements de charges
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                  <th className="pb-3 font-medium">Date & Réf</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Catégorie</th>
                  <th className="pb-3 font-medium text-center">Mode Paiement</th>
                  <th className="pb-3 font-medium text-right">Montant</th>
                  <th className="pb-3 font-medium text-right">Enregistré par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242a38]">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-[#222734] transition-colors">
                    <td className="py-3 text-gray-400">
                      {new Date(exp.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 font-bold text-white">{exp.description}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2e2630] text-rose-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 text-center uppercase font-mono font-bold text-gray-300">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3 text-right font-extrabold text-rose-400 text-sm">
                      -{exp.amount.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-3 text-right text-gray-400">{exp.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Enregistrer une Dépense</h3>
              <button onClick={() => setShowAddExpenseModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  placeholder="ex: Facture électricité CIE, 30L carburant groupe..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Montant (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Catégorie</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="detergents">Détergents & Shampoings</option>
                    <option value="eau_electricite">Eau & Électricité (SODECI/CIE)</option>
                    <option value="carburant">Carburant Groupe</option>
                    <option value="maintenance">Maintenance Karcher/Pompes</option>
                    <option value="salaire_prime">Primes & Personnel</option>
                    <option value="autre">Autre charge</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Mode de Paiement de la Dépense</label>
                <select
                  value={expensePaymentMethod}
                  onChange={e => setExpensePaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="especes">Espèces Caisse</option>
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN MoMo</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md"
                >
                  Valider la Dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Stock Item */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Ajouter un Consommable</h3>
              <button onClick={() => setShowAddStockModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStockItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom du Produit</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="ex: Shampoing Brillance Carrosserie"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Quantité Initiale</label>
                  <input
                    type="number"
                    required
                    value={itemQty}
                    onChange={e => setItemQty(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Unité</label>
                  <input
                    type="text"
                    value={itemUnit}
                    onChange={e => setItemUnit(e.target.value)}
                    placeholder="Litres, Pièces..."
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Seuil Alerte Min</label>
                  <input
                    type="number"
                    value={itemThreshold}
                    onChange={e => setItemThreshold(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Prix Unitaire (FCFA)</label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={e => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
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
