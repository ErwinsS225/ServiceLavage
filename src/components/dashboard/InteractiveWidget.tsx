import React from 'react';
import { ArrowRight } from 'lucide-react';

interface InteractiveWidgetProps {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    badgeText: string;
    badgeType: 'positive' | 'neutral';
    onClick?: () => void;
    colorClass: string;
    hoverColorClass: string;
    borderColorClass: string;
    buttonText: string;
}

export const InteractiveWidget: React.FC<InteractiveWidgetProps> = ({
    title,
    value,
    subtitle,
    icon,
    badgeText,
    badgeType,
    onClick,
    colorClass,
    hoverColorClass,
    borderColorClass,
    buttonText,
}) => {
    const badgeColor =
        badgeType === 'positive'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

    return (
        <div
            onClick={onClick}
            className={`p-5 rounded-2xl bg-gradient-to-br from-[#1a2232] via-[#1c202a] to-[#171b24] border ${borderColorClass} ${hoverColorClass} shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer group relative overflow-hidden`}
        >
            <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${colorClass}`}>
                    {icon}
                    <span className="text-xs font-extrabold uppercase tracking-wider">{title}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {badgeText}
                </span>
            </div>

            <div className="mt-3">
                <div className={`text-2xl font-black text-white group-hover:${colorClass} transition-colors`}>
                    {value}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>
            </div>

            <div
                className={`mt-4 pt-3 border-t border-[#283244] flex items-center justify-between text-xs font-bold ${colorClass} group-hover:${colorClass}`}
            >
                <span>{buttonText}</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
        </div>
    );
};