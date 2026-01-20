/**
 * Modal de Gerenciamento de Usuários do Proton
 * Apenas Admin Master pode acessar
 */

import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Building2, Calendar, UserPlus, Shield, Search, ChevronDown, ChevronRight, Phone, Activity, Clock, Key, Trash2, Eye, Calendar as CalendarIcon, BarChart2, ArrowLeft } from 'lucide-react';
import { User, Appointment as AppointmentType, Patient as PatientType, CalendarViewMode } from '../types';
import { CalendarGrid } from './CalendarGrid';
import { PatientsView } from './PatientsView';
import { ReportsView } from './ReportsView';
import { apiData } from '../services/api';
import { subDays, addDays, subWeeks, addWeeks, subMonths, addMonths } from 'date-fns';

interface UsersManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    onStartMirrorMode?: (userId: string, userName: string, userEmail: string) => void;
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

export const UsersManagementModal: React.FC<UsersManagementModalProps> = ({ isOpen, onClose, currentUser, onStartMirrorMode }) => {
    const [users, setUsers] = useState<ProtonUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loadingUserData, setLoadingUserData] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [resetPasswordDialog, setResetPasswordDialog] = useState<{
        isOpen: boolean;
        user: ProtonUser | null;
        newPassword: string;
        confirmPassword: string;
    }>({
        isOpen: false,
        user: null,
        newPassword: '',
        confirmPassword: ''
    });
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        user: ProtonUser | null;
    }>({
        isOpen: false,
        user: null
    });
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [createUserDialog, setCreateUserDialog] = useState<{
        isOpen: boolean;
        email: string;
        name: string;
        clinicName: string;
        password: string;
        confirmPassword: string;
    }>({
        isOpen: false,
        email: '',
        name: '',
        clinicName: '',
        password: '',
        confirmPassword: ''
    });
    const [createUserLoading, setCreateUserLoading] = useState(false);
    const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'details' | 'mirror'>('details');
    const [mirrorView, setMirrorView] = useState<'calendar' | 'patients' | 'reports'>('calendar');
    const [mirrorAppointments, setMirrorAppointments] = useState<AppointmentType[]>([]);
    const [mirrorPatients, setMirrorPatients] = useState<PatientType[]>([]);
    const [mirrorDoctors, setMirrorDoctors] = useState<any[]>([]);
    const [mirrorLoading, setMirrorLoading] = useState(false);
    const [mirrorCurrentDate, setMirrorCurrentDate] = useState(new Date());
    const [mirrorViewMode, setMirrorViewMode] = useState<CalendarViewMode>('week');

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
            setViewMode('details');
        } else {
            setSelectedUserId(userId);
            setViewMode('details');
            fetchUserData(userId);
        }
    };

    // Carregar dados para visualização espelho
    const loadMirrorData = async (userId: string) => {
        setMirrorLoading(true);
        try {
            // Carregar agendamentos, pacientes e doutores do usuário
            const [appointments, patients, doctors] = await Promise.all([
                apiData.getAppointments(userId, false),
                apiData.getPatients(userId, false),
                apiData.getDoctors(userId, false)
            ]);

            setMirrorAppointments(appointments);
            setMirrorPatients(patients);
            setMirrorDoctors(doctors);
        } catch (err: any) {
            console.error('Erro ao carregar dados do espelho:', err);
            setError(err.message || 'Erro ao carregar dados do usuário');
        } finally {
            setMirrorLoading(false);
        }
    };

    const handleViewAsUser = async (userId: string) => {
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser && onStartMirrorMode) {
            // Transferir visualização para a tela principal
            onStartMirrorMode(userId, selectedUser.name, selectedUser.email);
            onClose(); // Fechar o modal
        } else {
            // Fallback: manter no modal (caso onStartMirrorMode não esteja disponível)
            setViewMode('mirror');
            setSelectedUserId(userId);
            await loadMirrorData(userId);
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

    // Função para resetar senha
    const handleResetPassword = (user: ProtonUser) => {
        setResetPasswordDialog({
            isOpen: true,
            user,
            newPassword: '',
            confirmPassword: ''
        });
        setResetSuccess(null);
    };

    const handleConfirmResetPassword = async () => {
        if (!resetPasswordDialog.user) return;

        if (!resetPasswordDialog.newPassword || resetPasswordDialog.newPassword.length < 6) {
            setResetSuccess('❌ A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (resetPasswordDialog.newPassword !== resetPasswordDialog.confirmPassword) {
            setResetSuccess('❌ As senhas não coincidem');
            return;
        }

        setResetLoading(true);
        setResetSuccess(null);

        try {
            const response = await fetch('/api/reset-user-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: resetPasswordDialog.user.id,
                    newPassword: resetPasswordDialog.newPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setResetSuccess(`✅ Senha resetada com sucesso para ${resetPasswordDialog.user.email}`);
                setResetPasswordDialog({
                    isOpen: false,
                    user: null,
                    newPassword: '',
                    confirmPassword: ''
                });
                setTimeout(() => setResetSuccess(null), 3000);
            } else {
                const errorMsg = data.error || 'Erro ao resetar senha';
                const detailsMsg = data.details ? `\n\n${data.details}` : '';
                setResetSuccess(`❌ Erro: ${errorMsg}${detailsMsg}`);
            }
        } catch (err: any) {
            console.error('Erro ao resetar senha:', err);
            setResetSuccess(`❌ Erro: ${err.message || 'Erro ao resetar senha'}`);
        } finally {
            setResetLoading(false);
        }
    };

    // Função para deletar usuário
    const handleDeleteUser = (user: ProtonUser) => {
        setDeleteDialog({
            isOpen: true,
            user
        });
    };

    const handleConfirmDeleteUser = async () => {
        if (!deleteDialog.user) return;

        setDeleteLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: deleteDialog.user.id
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Remover usuário da lista
                setUsers(prev => prev.filter(u => u.id !== deleteDialog.user!.id));
                
                // Se o usuário deletado estava selecionado, limpar seleção
                if (selectedUserId === deleteDialog.user.id) {
                    setSelectedUserId(null);
                    setUserData(null);
                }

                setDeleteDialog({
                    isOpen: false,
                    user: null
                });

                // Mostrar mensagem de sucesso temporária
                setError(`✅ ${data.message}`);
                setTimeout(() => setError(null), 3000);
            } else {
                const errorMsg = data.error || 'Erro ao deletar usuário';
                const detailsMsg = data.details ? `\n\n${data.details}` : '';
                setError(`❌ Erro: ${errorMsg}${detailsMsg}`);
            }
        } catch (err: any) {
            console.error('Erro ao deletar usuário:', err);
            setError(`❌ Erro: ${err.message || 'Erro ao deletar usuário'}`);
        } finally {
            setDeleteLoading(false);
        }
    };

    // Função para criar usuário
    const handleCreateUser = () => {
        setCreateUserDialog({
            isOpen: true,
            email: '',
            name: '',
            clinicName: '',
            password: '',
            confirmPassword: ''
        });
        setCreateUserSuccess(null);
    };

    const handleConfirmCreateUser = async () => {
        if (!createUserDialog.email || !createUserDialog.email.includes('@')) {
            setCreateUserSuccess('❌ Email inválido');
            return;
        }

        if (!createUserDialog.name || createUserDialog.name.trim().length === 0) {
            setCreateUserSuccess('❌ Nome é obrigatório');
            return;
        }

        if (!createUserDialog.password || createUserDialog.password.length < 6) {
            setCreateUserSuccess('❌ A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (createUserDialog.password !== createUserDialog.confirmPassword) {
            setCreateUserSuccess('❌ As senhas não coincidem');
            return;
        }

        setCreateUserLoading(true);
        setCreateUserSuccess(null);

        try {
            const response = await fetch('/api/create-proton-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: createUserDialog.email.trim(),
                    name: createUserDialog.name.trim(),
                    clinicName: createUserDialog.clinicName.trim(),
                    password: createUserDialog.password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setCreateUserSuccess(`✅ Usuário ${data.user.email} criado com sucesso!`);
                setCreateUserDialog({
                    isOpen: false,
                    email: '',
                    name: '',
                    clinicName: '',
                    password: '',
                    confirmPassword: ''
                });
                
                // Atualizar lista de usuários
                await fetchUsers();
                
                setTimeout(() => setCreateUserSuccess(null), 3000);
            } else {
                const errorMsg = data.error || 'Erro ao criar usuário';
                const detailsMsg = data.details ? `\n\n${data.details}` : '';
                setCreateUserSuccess(`❌ Erro: ${errorMsg}${detailsMsg}`);
            }
        } catch (err: any) {
            console.error('Erro ao criar usuário:', err);
            setCreateUserSuccess(`❌ Erro: ${err.message || 'Erro ao criar usuário'}`);
        } finally {
            setCreateUserLoading(false);
        }
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
                        {/* Search and Add User */}
                        <div className="p-4 border-b border-slate-200 space-y-3">
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
                            <button
                                onClick={handleCreateUser}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Adicionar Usuário
                            </button>
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

                    {/* Right Panel - User Details or Mirror View */}
                    <div className="w-1/2 flex flex-col">
                        {selectedUserId ? (
                            <>
                                {viewMode === 'mirror' ? (
                                    /* Mirror View - Ver como usuário vê */
                                    <div className="flex-1 flex flex-col bg-slate-50">
                                        {/* Header do Mirror */}
                                        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setViewMode('details')}
                                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                                                </button>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                        <Eye className="w-5 h-5 text-indigo-600" />
                                                        Visualizando como: {userData?.user?.email || users.find(u => u.id === selectedUserId)?.email}
                                                    </h3>
                                                    <p className="text-xs text-slate-500">Modo espelho - apenas visualização</p>
                                                </div>
                                            </div>
                                            {/* Navigation Tabs */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setMirrorView('calendar')}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                        mirrorView === 'calendar'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    <CalendarIcon className="w-4 h-4" />
                                                    Agenda
                                                </button>
                                                <button
                                                    onClick={() => setMirrorView('patients')}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                        mirrorView === 'patients'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    <Users className="w-4 h-4" />
                                                    Pacientes
                                                </button>
                                                <button
                                                    onClick={() => setMirrorView('reports')}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                                        mirrorView === 'reports'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    <BarChart2 className="w-4 h-4" />
                                                    Relatórios
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mirror Content */}
                                        <div className="flex-1 overflow-y-auto">
                                            {mirrorLoading ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                                </div>
                                            ) : (
                                                <>
                                                    {mirrorView === 'calendar' && (
                                                        <div className="p-4">
                                                            {/* Calendar Controls */}
                                                            <div className="mb-4 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        value={mirrorViewMode}
                                                                        onChange={(e) => setMirrorViewMode(e.target.value as CalendarViewMode)}
                                                                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                    >
                                                                        <option value="day">Dia</option>
                                                                        <option value="week">Semana</option>
                                                                        <option value="month">Mês</option>
                                                                    </select>
                                                                    <button
                                                                        onClick={() => setMirrorCurrentDate(new Date())}
                                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm transition-colors"
                                                                    >
                                                                        Hoje
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            let prev: Date;
                                                                            if (mirrorViewMode === 'day') {
                                                                                prev = subDays(mirrorCurrentDate, 1);
                                                                            } else if (mirrorViewMode === 'week') {
                                                                                prev = subWeeks(mirrorCurrentDate, 1);
                                                                            } else {
                                                                                prev = subMonths(mirrorCurrentDate, 1);
                                                                            }
                                                                            setMirrorCurrentDate(prev);
                                                                        }}
                                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm transition-colors"
                                                                    >
                                                                        ‹
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            let next: Date;
                                                                            if (mirrorViewMode === 'day') {
                                                                                next = addDays(mirrorCurrentDate, 1);
                                                                            } else if (mirrorViewMode === 'week') {
                                                                                next = addWeeks(mirrorCurrentDate, 1);
                                                                            } else {
                                                                                next = addMonths(mirrorCurrentDate, 1);
                                                                            }
                                                                            setMirrorCurrentDate(next);
                                                                        }}
                                                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm transition-colors"
                                                                    >
                                                                        ›
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <CalendarGrid
                                                                currentDate={mirrorCurrentDate}
                                                                viewMode={mirrorViewMode}
                                                                appointments={mirrorAppointments}
                                                                onSelectAppointment={() => {}}
                                                                searchTerm=""
                                                            />
                                                        </div>
                                                    )}
                                                    {mirrorView === 'patients' && (
                                                        <div className="p-4">
                                                            <PatientsView
                                                                patients={mirrorPatients}
                                                                appointments={mirrorAppointments}
                                                                searchTerm=""
                                                                onSearchChange={() => {}}
                                                                onAddPatient={() => {}}
                                                                onUpdatePatient={() => {}}
                                                                onDeletePatient={() => {}}
                                                                onCreateAppointment={() => {}}
                                                            />
                                                        </div>
                                                    )}
                                                    {mirrorView === 'reports' && (
                                                        <div className="p-4">
                                                            <ReportsView appointments={mirrorAppointments} />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Details View - Informações e ações */
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
                                                        <div className="space-y-4">
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
                                                            {/* Action Buttons */}
                                                            <div className="flex gap-2 pt-2 border-t border-indigo-200">
                                                                <button
                                                                    onClick={() => handleViewAsUser(userData.user!.id)}
                                                                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    Ver como usuário
                                                                </button>
                                                                <button
                                                                    onClick={() => handleResetPassword(userData.user ? {
                                                                        id: userData.user.id,
                                                                        email: userData.user.email,
                                                                        name: userData.user.name,
                                                                        clinicName: userData.user.clinicName,
                                                                        createdAt: userData.user.createdAt,
                                                                        lastSignIn: null,
                                                                        emailConfirmed: true
                                                                    } : users.find(u => u.id === selectedUserId)!)}
                                                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Key className="w-4 h-4" />
                                                                    Resetar Senha
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteUser(userData.user ? {
                                                                        id: userData.user.id,
                                                                        email: userData.user.email,
                                                                        name: userData.user.name,
                                                                        clinicName: userData.user.clinicName,
                                                                        createdAt: userData.user.createdAt,
                                                                        lastSignIn: null,
                                                                        emailConfirmed: true
                                                                    } : users.find(u => u.id === selectedUserId)!)}
                                                                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Deletar
                                                                </button>
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

            {/* Reset Password Dialog */}
            {resetPasswordDialog.isOpen && resetPasswordDialog.user && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Resetar Senha</h3>
                            <p className="text-sm text-slate-500 mt-1">{resetPasswordDialog.user.email}</p>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                                <input
                                    type="password"
                                    value={resetPasswordDialog.newPassword}
                                    onChange={(e) => setResetPasswordDialog({
                                        ...resetPasswordDialog,
                                        newPassword: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                                <input
                                    type="password"
                                    value={resetPasswordDialog.confirmPassword}
                                    onChange={(e) => setResetPasswordDialog({
                                        ...resetPasswordDialog,
                                        confirmPassword: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Digite a senha novamente"
                                />
                            </div>
                            {resetSuccess && (
                                <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
                                    resetSuccess.startsWith('✅') 
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                    {resetSuccess}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
                            <button
                                onClick={() => setResetPasswordDialog({
                                    isOpen: false,
                                    user: null,
                                    newPassword: '',
                                    confirmPassword: ''
                                })}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                                disabled={resetLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmResetPassword}
                                disabled={resetLoading || !resetPasswordDialog.newPassword}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resetLoading ? 'Resetando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete User Dialog */}
            {deleteDialog.isOpen && deleteDialog.user && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Deletar Usuário</h3>
                            <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-slate-700 mb-4">
                                Tem certeza que deseja deletar o usuário <strong>{deleteDialog.user.email}</strong>?
                            </p>
                            <p className="text-xs text-rose-600 mb-4">
                                ⚠️ Todos os dados relacionados serão deletados permanentemente (agendamentos, pacientes, doutores).
                            </p>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
                            <button
                                onClick={() => setDeleteDialog({
                                    isOpen: false,
                                    user: null
                                })}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                                disabled={deleteLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDeleteUser}
                                disabled={deleteLoading}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deleteLoading ? 'Deletando...' : 'Deletar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Dialog */}
            {createUserDialog.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Adicionar Usuário</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={createUserDialog.email}
                                    onChange={(e) => setCreateUserDialog({
                                        ...createUserDialog,
                                        email: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="usuario@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={createUserDialog.name}
                                    onChange={(e) => setCreateUserDialog({
                                        ...createUserDialog,
                                        name: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Nome completo"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Clínica (opcional)</label>
                                <input
                                    type="text"
                                    value={createUserDialog.clinicName}
                                    onChange={(e) => setCreateUserDialog({
                                        ...createUserDialog,
                                        clinicName: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Nome da clínica"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                                <input
                                    type="password"
                                    value={createUserDialog.password}
                                    onChange={(e) => setCreateUserDialog({
                                        ...createUserDialog,
                                        password: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                                <input
                                    type="password"
                                    value={createUserDialog.confirmPassword}
                                    onChange={(e) => setCreateUserDialog({
                                        ...createUserDialog,
                                        confirmPassword: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Digite a senha novamente"
                                />
                            </div>
                            {createUserSuccess && (
                                <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
                                    createUserSuccess.startsWith('✅') 
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                    {createUserSuccess}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
                            <button
                                onClick={() => setCreateUserDialog({
                                    isOpen: false,
                                    email: '',
                                    name: '',
                                    clinicName: '',
                                    password: '',
                                    confirmPassword: ''
                                })}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                                disabled={createUserLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmCreateUser}
                                disabled={createUserLoading || !createUserDialog.email || !createUserDialog.name || !createUserDialog.password}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createUserLoading ? 'Criando...' : 'Criar Usuário'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
