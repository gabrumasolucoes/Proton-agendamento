/**
 * Modal de Gerenciamento de Usuários do Proton
 * Apenas Admin Master pode acessar
 */

import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Building2, Calendar, UserPlus, Shield, Search, ChevronDown, ChevronRight, Phone, Activity, Clock } from 'lucide-react';
import { User } from '../types';

interface UsersManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
}

interface ProtonUser {
    id: string;
    email: string;
    name: string;
    clinicName: string;
    createdAt: string;
    lastSignIn: string | null;
    emailConfirmed: boolean;
}

interface UserData {
    user: {
        id: string;
        email: string;
        name: string;
        clinicName: string;
        createdAt: string;
    } | null;
    appointments: any[];
    patients: any[];
    doctors: any[];
    stats: {
        totalAppointments: number;
        totalPatients: number;
        totalDoctors: number;
    };
}

export const UsersManagementModal: React.FC<UsersManagementModalProps> = ({ isOpen, onClose, currentUser }) => {
    const [users, setUsers] = useState<ProtonUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loadingUserData, setLoadingUserData] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen && currentUser?.isAdmin) {
            fetchUsers();
        }
    }, [isOpen, currentUser]);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/list-users');
            const data = await response.json();

            if (data.success && data.users) {
                setUsers(data.users);
            } else {
                setError(data.error || 'Erro ao buscar usuários');
            }
        } catch (err: any) {
            console.error('Erro ao buscar usuários:', err);
            setError(err.message || 'Erro ao buscar usuários');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserData = async (userId: string) => {
        setLoadingUserData(true);
        setError(null);
        try {
            const response = await fetch(`/api/get-user-data?userId=${userId}`);
            const data = await response.json();

            if (data.success) {
                setUserData(data);
            } else {
                setError(data.error || 'Erro ao buscar dados do usuário');
            }
        } catch (err: any) {
            console.error('Erro ao buscar dados do usuário:', err);
            setError(err.message || 'Erro ao buscar dados do usuário');
        } finally {
            setLoadingUserData(false);
        }
    };

    const handleUserClick = (userId: string) => {
        if (selectedUserId === userId) {
            setSelectedUserId(null);
            setUserData(null);
        } else {
            setSelectedUserId(userId);
            fetchUserData(userId);
        }
    };

    const toggleUserExpand = (userId: string) => {
        const newExpanded = new Set(expandedUsers);
        if (newExpanded.has(userId)) {
            newExpanded.delete(userId);
        } else {
            newExpanded.add(userId);
        }
        setExpandedUsers(newExpanded);
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.clinicName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Gerenciamento de Usuários</h2>
                            <p className="text-sm text-slate-500">Admin Master - Proton</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Left Panel - Users List */}
                    <div className="w-1/2 border-r border-slate-200 flex flex-col">
                        {/* Search */}
                        <div className="p-4 border-b border-slate-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar usuários..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : error ? (
                                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Nenhum usuário encontrado</p>
                                </div>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isExpanded = expandedUsers.has(user.id);
                                    const isSelected = selectedUserId === user.id;

                                    return (
                                        <div
                                            key={user.id}
                                            className={`border rounded-lg transition-all ${
                                                isSelected
                                                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div
                                                className="p-4 cursor-pointer"
                                                onClick={() => handleUserClick(user.id)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Mail className="w-4 h-4 text-slate-400" />
                                                            <span className="font-semibold text-slate-900">{user.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mb-1 ml-6">
                                                            <span className="text-sm text-slate-600">{user.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-6">
                                                            <Building2 className="w-3 h-3 text-slate-400" />
                                                            <span className="text-xs text-slate-500">{user.clinicName}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleUserExpand(user.id);
                                                        }}
                                                        className="p-1 hover:bg-slate-100 rounded"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
                                                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">Criado em:</span>
                                                            <p className="text-slate-700 font-medium">
                                                                {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Último acesso:</span>
                                                            <p className="text-slate-700 font-medium">
                                                                {user.lastSignIn
                                                                    ? new Date(user.lastSignIn).toLocaleDateString('pt-BR')
                                                                    : 'Nunca'}
                                                            </p>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <span className="text-slate-500">Email confirmado:</span>
                                                            <p className="text-slate-700 font-medium">
                                                                {user.emailConfirmed ? 'Sim' : 'Não'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <div className="text-sm text-slate-600">
                                Total: <span className="font-semibold text-slate-900">{filteredUsers.length}</span> usuário(s)
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - User Details */}
                    <div className="w-1/2 flex flex-col">
                        {selectedUserId && (
                            <>
                                {loadingUserData ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : userData ? (
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {/* User Info */}
                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-indigo-600" />
                                                Informações do Usuário
                                            </h3>
                                            {userData.user ? (
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-slate-500">Nome:</span>
                                                        <p className="text-slate-900 font-semibold">{userData.user.name}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Email:</span>
                                                        <p className="text-slate-900 font-semibold">{userData.user.email}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Clínica:</span>
                                                        <p className="text-slate-900 font-semibold">{userData.user.clinicName}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Criado em:</span>
                                                        <p className="text-slate-900 font-semibold">
                                                            {new Date(userData.user.createdAt).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-slate-500 text-sm">Perfil não encontrado</p>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                                                <Calendar className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                                                <div className="text-2xl font-bold text-slate-900">{userData.stats.totalAppointments}</div>
                                                <div className="text-xs text-slate-500">Agendamentos</div>
                                            </div>
                                            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                                                <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                                                <div className="text-2xl font-bold text-slate-900">{userData.stats.totalPatients}</div>
                                                <div className="text-xs text-slate-500">Pacientes</div>
                                            </div>
                                            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                                                <Activity className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                                <div className="text-2xl font-bold text-slate-900">{userData.stats.totalDoctors}</div>
                                                <div className="text-xs text-slate-500">Doutores</div>
                                            </div>
                                        </div>

                                        {/* Appointments List */}
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                Agendamentos Recentes ({userData.appointments.length})
                                            </h4>
                                            {userData.appointments.length === 0 ? (
                                                <p className="text-sm text-slate-500">Nenhum agendamento</p>
                                            ) : (
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {userData.appointments.slice(0, 10).map((apt: any) => (
                                                        <div
                                                            key={apt.id}
                                                            className="bg-white border border-slate-200 rounded-lg p-3 text-sm"
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-semibold text-slate-900">{apt.patient_name || 'Sem nome'}</span>
                                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                                    apt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                                    apt.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {apt.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500">{apt.title || 'Sem título'}</p>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                {new Date(apt.start_time).toLocaleString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-slate-500">
                                        Erro ao carregar dados do usuário
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-sm">Selecione um usuário para ver detalhes</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
