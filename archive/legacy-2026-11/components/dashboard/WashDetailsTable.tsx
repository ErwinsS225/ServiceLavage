import React from 'react';
import { WashOrder, PaymentStatus } from '../../types';
import { Receipt } from 'lucide-react';

interface WashDetailsTableProps {
    orders: WashOrder[];
    formatCurrency: (amount: number) => string;
    setSelectedOrderForTicket: (order: WashOrder) => void;
    setSelectedOrderForDetail: (order: WashOrder) => void;
    updatePaymentStatus: (orderId: string, status: PaymentStatus) => void;
    getCategoryBadge: (category: string) => string;
}

export const WashDetailsTable: React.FC<WashDetailsTableProps> = ({
    orders,
    formatCurrency,
    setSelectedOrderForTicket,
    setSelectedOrderForDetail,
    updatePaymentStatus,
    getCategoryBadge,
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                        <th className="pb-3 font-medium">Véhicule & Info</th>
                        <th className="pb-3 font-medium">Formule de Lavage</th>
                        <th className="pb-3 font-medium text-center">Piste</th>
                        <th className="pb-3 font-medium text-center">Statut</th>
                        <th className="pb-3 font-medium text-right">Montant Facturé</th>
                        <th className="pb-3 font-medium text-right pr-2">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#242a38]">
                    {orders.slice(0, 8).map((order) => (
                        <tr
                            key={order.id}
                            className="hover:bg-[#222734] transition-colors group cursor-pointer"
                            onClick={() => setSelectedOrderForDetail(order)}
                        >
                            <td className="py-3 pr-2">
                                <div className="font-semibold text-gray-200 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                                    <span>{order.vehicleInfo}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono tracking-tight">
                                    {order.plateNumber}
                                </div>
                            </td>
                            <td className="py-3 px-2">
                                <span
                                    className={`inline-block px-3 py-1 rounded-md text-[11px] font-medium ${getCategoryBadge(
                                        order.washCategory
                                    )}`}
                                >
                                    {order.washCategory}
                                </span>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-300 font-semibold">
                                {order.bayArea}
                            </td>
                            <td className="py-3 px-2 text-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        order.isDelayed = !order.isDelayed;
                                    }}
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${order.isDelayed
                                            ? 'bg-[#3b2a1a] text-[#fb923c] border border-[#643f1f]'
                                            : 'bg-[#183b28] text-[#4ade80] border border-[#23583c]'
                                        }`}
                                    title="Cliquer pour changer statut"
                                >
                                    {order.isDelayed ? 'En retard' : 'Dans les temps'}
                                </button>
                            </td>
                            <td className="py-3 pl-2 text-right font-semibold text-gray-200">
                                {formatCurrency(order.amount)}
                            </td>
                            <td className="py-3 pr-2 text-right">
                                <div
                                    className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => setSelectedOrderForTicket(order)}
                                        className="p-1 rounded bg-[#272e3d] text-cyan-400 hover:bg-cyan-500/20"
                                        title="Imprimer / Voir le ticket"
                                    >
                                        <Receipt className="w-3.5 h-3.5" />
                                    </button>
                                    {order.paymentStatus !== 'paye' && (
                                        <button
                                            onClick={() => updatePaymentStatus(order.id, 'paye')}
                                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold"
                                            title="Encaisser"
                                        >
                                            Payer
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};