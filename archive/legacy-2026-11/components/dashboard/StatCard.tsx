import React from 'react';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    percentageChange: number;
    timeframe: string;
    onClick?: () => void;
    colorClass: string;
    iconBgClass: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    percentageChange,
    timeframe,
    onClick,
    colorClass,
    iconBgClass,
}) => {
    return (
        <div
            onClick={onClick}
            className={`bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm hover:border-cyan-500/50 transition-all cursor-pointer group`}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`w-10 h-10 rounded-full ${iconBgClass} flex items-center justify-center ${colorClass} group-hover:scale-105 transition-transform`}
                >
                    {icon}
                </div>
                <span className="text-xs font-medium text-gray-300">{title}</span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-white tracking-tight">
                    {value}
                </span>
                <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+{percentageChange}%</span>
                    <span className="text-gray-400 font-normal">vs {timeframe}</span>
                </div>
            </div>
        </div>
    );
};