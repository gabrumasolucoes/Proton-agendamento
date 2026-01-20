
import React, { useState, useEffect } from 'react';
import { addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { Eye, ArrowLeft, Shield } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { CalendarGrid } from './components/CalendarGrid';
import { AppointmentDetails } from './components/AppointmentDetails';
import { CreateAppointmentModal } from './components/CreateAppointmentModal';
import { PatientsView } from './components/PatientsView';
import { ReportsView } from './components/ReportsView';
import { SettingsModal } from './components/SettingsModal';
import { AutoLoginHandler } from './components/AutoLoginHandler';
import { UsersManagementModal } from './components/UsersManagementModal';
import { DEFAULT_TAGS, MOCK_NOTIFICATIONS } from './constants';
import { Appointment, ProcedureTag, DoctorProfile, Patient, AppNotification, CalendarViewMode, User } from './types';
import { apiData, apiAuth } from './services/api';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // App State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]); 
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'patients' | 'reports'>('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [mirrorMode, setMirrorMode] = useState<{
    isActive: boolean;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
  }>({
    isActive: false,
    userId: null,
    userName: null,
    userEmail: null
  });
  
  // State for tags
  const [tags, setTags] = useState<ProcedureTag[]>(DEFAULT_TAGS);

  // --- Auth & Data Loading Logic ---

  // Initial Session Check
  useEffect(() => {
      const init = async () => {
          setLoading(true);
          const currentUser = await apiAuth.getCurrentUser();
          if (currentUser) {
              setUser(currentUser);
              setIsDemoMode(false);
              await loadData(currentUser.id, false);
          } else {
              setLoading(false);
          }
      };
      init();
  }, []);

  const loadData = async (userId: string, isDemo: boolean) => {
      setLoading(true);
      try {
          // Se for admin master SEM mirror mode, não carregar dados
          if (user?.isAdmin && userId === 'proton_admin_master' && !mirrorMode.isActive) {
              // Admin master não carrega dados normais, apenas verá gerenciamento
              setAppointments([]);
              setPatients([]);
              setDoctors([]);
              setNotifications([]);
              setLoading(false);
              return;
          }

          // Se estiver em mirror mode, SEMPRE usar userId do mirror (ignorar parâmetro userId)
          // Caso contrário, usar o userId passado como parâmetro
          const targetUserId = mirrorMode.isActive && mirrorMode.userId ? mirrorMode.userId : userId;

          console.log('[loadData] Carregando dados:', { 
              userId, 
              mirrorMode: mirrorMode.isActive, 
              mirrorUserId: mirrorMode.userId, 
              targetUserId 
          });

          let apts: Appointment[] = [];
          let pts: Patient[] = [];
          let docs: DoctorProfile[] = [];

          // Se estiver em mirror mode, usar endpoint admin que bypassa RLS
          if (mirrorMode.isActive && mirrorMode.userId && user?.isAdmin) {
              console.log('[loadData] Usando endpoint admin para mirror mode');
              try {
                  const response = await fetch(`/api/get-user-data?userId=${targetUserId}`);
                  const data = await response.json();
                  
                  if (data.success) {
                      // Converter dados do formato backend para formato frontend
                      apts = (data.appointments || []).map((apt: any) => ({
                          ...apt,
                          patientId: apt.patient_id,
                          patientName: apt.patient_name,
                          doctorId: apt.doctor_id,
                          start: new Date(apt.start_time),
                          end: new Date(apt.end_time),
                      }));
                      pts = (data.patients || []) as Patient[];
                      docs = (data.doctors || []) as DoctorProfile[];
                      
                      console.log('[loadData] Dados carregados via admin endpoint:', { 
                          appointments: apts.length, 
                          patients: pts.length, 
                          doctors: docs.length 
                      });
                  } else {
                      console.error('[loadData] Erro ao carregar dados via admin endpoint:', data.error);
                  }
              } catch (error) {
                  console.error('[loadData] Erro ao chamar endpoint admin:', error);
              }
          } else {
              // Usar métodos normais do apiData (para usuários normais)
              const results = await Promise.all([
                  apiData.getAppointments(targetUserId, isDemo),
                  apiData.getPatients(targetUserId, isDemo),
                  apiData.getDoctors(targetUserId, isDemo)
              ]);
              
              apts = results[0];
              pts = results[1];
              docs = results[2];
              
              console.log('[loadData] Dados carregados via apiData:', { 
                  appointments: apts.length, 
                  patients: pts.length, 
                  doctors: docs.length 
              });
          }

          setAppointments(apts);
          setPatients(pts);
          
          // Em mirror mode, sempre usar os doctors recebidos da API
          // Não criar doctor automaticamente em mirror mode
          if (docs.length === 0 && !isDemo && !mirrorMode.isActive) {
               // Create initial doctor if none exists for new user (apenas se não estiver em mirror mode)
               const newDoc = await apiData.saveDoctor({
                   name: user?.name || 'Médico Principal',
                   specialty: 'Geral',
                   color: '#3b82f6',
                   active: true
               }, targetUserId, isDemo);
               setDoctors([newDoc]);
          } else {
              setDoctors(docs);
          }

          console.log('[loadData] Estado atualizado:', { 
              appointmentsCount: apts.length, 
              patientsCount: pts.length, 
              doctorsCount: docs.length 
          });

          setNotifications(isDemo ? MOCK_NOTIFICATIONS : []);
      } catch (e) {
          console.error("Failed to load data", e);
      } finally {
          setLoading(false);
      }
  };

  const handleLogin = async (loggedInUser: User, isDemo: boolean = false) => {
      setUser(loggedInUser);
      setIsDemoMode(isDemo);
      await loadData(loggedInUser.id, isDemo);
  };

  const handleLogout = async () => {
      if (!isDemoMode) {
          await apiAuth.signOut();
      }
      setUser(null);
      setAppointments([]);
      setPatients([]);
      setDoctors([]);
  };

  // ---------------------------------

  const handlePrev = () => {
      if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
      if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
      if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNext = () => {
      if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
      if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
      if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const addNotification = (title: string, message: string, type: AppNotification['type'] = 'info') => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      time: 'Agora',
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCreateClick = (type: 'event' | 'task' | 'appointment') => {
    // PROTEÇÃO: Bloquear criação quando estiver em mirror mode
    if (mirrorMode.isActive) {
      addNotification('Ação Bloqueada', 'Não é possível criar agendamentos no modo visualização (espelho).', 'warning');
      return;
    }
    setEditingAppointment(null);
    setIsCreateModalOpen(true);
  };

  const handleToggleDoctor = (id: string) => {
    setDoctors(prev => prev.map(doc => 
        doc.id === id ? { ...doc, active: !doc.active } : doc
    ));
  };

  const handleAddDoctor = async (newDoc: Omit<DoctorProfile, 'id' | 'active'>) => {
      if (!user) return;
      try {
        const savedDoc = await apiData.saveDoctor({ ...newDoc, active: true }, user.id, isDemoMode);
        setDoctors([...doctors, savedDoc]);
        addNotification('Novo Profissional', `${newDoc.name} adicionado à equipe.`, 'success');
      } catch (e) {
          console.error(e);
      }
  };

  const handleRemoveDoctor = async (id: string) => {
      if (!user) return;
      await apiData.deleteDoctor(id, isDemoMode);
      setDoctors(prev => prev.filter(d => d.id !== id));
      addNotification('Profissional Removido', 'Filtro de profissional atualizado.', 'info');
  };

  // --- Patient Management ---
  const handleAddPatient = async (newPatient: Patient) => {
      if (!user) return;
      const savedPatient = await apiData.savePatient(newPatient, user.id, isDemoMode);
      setPatients(prev => [...prev, savedPatient]);
      addNotification('Paciente Cadastrado', `${newPatient.name} foi adicionado à base.`, 'success');
  };

  const handleUpdatePatient = async (updatedPatient: Patient) => {
      if (!user) return;
      await apiData.savePatient(updatedPatient, user.id, isDemoMode);
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      addNotification('Cadastro Atualizado', `Dados de ${updatedPatient.name} atualizados.`, 'info');
  };

  const handleDeletePatient = async (patientId: string) => {
      if (window.confirm('Tem certeza que deseja excluir este paciente?')) {
        await apiData.deletePatient(patientId, isDemoMode);
        setPatients(prev => prev.filter(p => p.id !== patientId));
        addNotification('Paciente Removido', 'O paciente foi removido da base de dados.', 'warning');
      }
  };

  const handleCreateAppointmentForPatient = (patient: Patient) => {
      const partialAppointment: any = {
          patientId: patient.id,
          patientName: patient.name,
          start: new Date(),
          end: new Date(new Date().setHours(new Date().getHours() + 1)),
          tags: []
      };
      setEditingAppointment(partialAppointment);
      setIsCreateModalOpen(true);
  };
  // --------------------------

  const handleSaveAppointment = async (appointmentData: Appointment | Omit<Appointment, 'id' | 'status'>) => {
    if (!user) return;

    // PROTEÇÃO: Bloquear salvamento quando estiver em mirror mode
    if (mirrorMode.isActive) {
      addNotification('Ação Bloqueada', 'Não é possível criar ou editar agendamentos no modo visualização (espelho).', 'warning');
      setIsCreateModalOpen(false);
      setEditingAppointment(null);
      return;
    }

    // Usar userId correto (não usar mirrorMode.userId aqui, pois está protegido acima)
    const targetUserId = user.id;

    let finalPatientId = appointmentData.patientId;
    let finalPatientName = appointmentData.patientName;

    // Handle "New Patient" logic implicitly
    if ((!finalPatientId || finalPatientId === 'new-patient') && finalPatientName) {
        const existingPatient = patients.find(p => p.name.toLowerCase() === finalPatientName.toLowerCase());
        
        if (existingPatient) {
            finalPatientId = existingPatient.id;
        } else {
            const newPatientObj: Patient = {
                id: '', // let backend assign
                name: finalPatientName,
                phone: '', 
                email: ''
            };
            const savedP = await apiData.savePatient(newPatientObj, targetUserId, isDemoMode);
            setPatients(prev => [...prev, savedP]);
            finalPatientId = savedP.id;
        }
    }

    const appointmentToSave = {
        ...appointmentData,
        patientId: finalPatientId,
        patientName: finalPatientName,
        status: (appointmentData as any).status || 'confirmed',
        doctorId: appointmentData.doctorId || doctors[0]?.id
    };

    const savedApt = await apiData.saveAppointment(appointmentToSave, targetUserId, isDemoMode);
    
    if (savedApt) {
        if ('id' in appointmentData) {
            // Edit
            setAppointments(prev => prev.map(apt => apt.id === savedApt.id ? savedApt : apt));
            addNotification('Agendamento Atualizado', `Consulta de ${finalPatientName} foi alterada.`, 'success');
        } else {
            // Create
            setAppointments(prev => [...prev, savedApt]);
            addNotification('Novo Agendamento', `Consulta para ${finalPatientName} criada.`, 'success');
        }
        setIsCreateModalOpen(false);
        setEditingAppointment(null);
        setSelectedAppointment(null);
    } else {
        // Error handling
        addNotification('Erro ao Salvar', 'Não foi possível salvar o agendamento. Tente sair e entrar novamente.', 'alert');
    }
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: Appointment['status']) => {
    if (!user) return;

    // PROTEÇÃO: Bloquear atualização de status quando estiver em mirror mode
    if (mirrorMode.isActive) {
      addNotification('Ação Bloqueada', 'Não é possível alterar status de agendamentos no modo visualização (espelho).', 'warning');
      return;
    }

    await apiData.updateAppointmentStatus(appointmentId, newStatus, isDemoMode);
    
    setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
    ));
    if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setSelectedAppointment(prev => prev ? { ...prev, status: newStatus } : null);
    }
    
    const statusLabels: Record<string, string> = {
        confirmed: 'Confirmado',
        cancelled: 'Cancelado',
        in_progress: 'Iniciado',
        completed: 'Finalizado',
        pending: 'Pendente'
    };
    addNotification('Status Atualizado', `Agendamento marcado como ${statusLabels[newStatus] || newStatus}.`, 'info');
  };

  const handleEditClick = (appointment: Appointment) => {
    // PROTEÇÃO: Bloquear edição quando estiver em mirror mode
    if (mirrorMode.isActive) {
      addNotification('Ação Bloqueada', 'Não é possível editar agendamentos no modo visualização (espelho).', 'warning');
      return;
    }
    setEditingAppointment(appointment);
    setSelectedAppointment(null); 
    setIsCreateModalOpen(true); 
  };
  
  const handleAddTag = (newTag: ProcedureTag) => {
      setTags([...tags, newTag]);
  };
  
  const handleRemoveTag = (tagId: string) => {
      setTags(prev => prev.filter(t => t.id !== tagId));
  };

  const filteredAppointments = appointments.filter(apt => {
      // Se não houver doctorId no agendamento, sempre mostrar
      if (!apt.doctorId) return true;
      
      // Se houver doctorId, verificar se o médico existe e está ativo
      const doctor = doctors.find(d => d.id === apt.doctorId);
      
      // Se o médico não existir na lista, ainda mostrar o agendamento (pode ter sido deletado)
      if (!doctor) return true;
      
      // Só filtrar se o médico existir e estiver inativo
      if (doctor && !doctor.active) return false;
      
      return true;
  });

  // Debug: Log dos agendamentos filtrados
  useEffect(() => {
      if (mirrorMode.isActive) {
          console.log('[filteredAppointments] Mirror mode ativo:', {
              totalAppointments: appointments.length,
              filteredAppointments: filteredAppointments.length,
              doctorsCount: doctors.length,
              doctors: doctors.map(d => ({ id: d.id, name: d.name, active: d.active }))
          });
      }
  }, [appointments, filteredAppointments, doctors, mirrorMode.isActive]);

  const renderContent = () => {
      switch (currentView) {
          case 'calendar':
              return (
                <CalendarGrid 
                    currentDate={currentDate}
                    viewMode={viewMode}
                    appointments={filteredAppointments}
                    onSelectAppointment={setSelectedAppointment}
                    searchTerm={searchTerm}
                    isReadOnly={mirrorMode.isActive}
                />
              );
          case 'patients':
              return (
                <PatientsView 
                    patients={patients}
                    appointments={filteredAppointments} 
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onAddPatient={mirrorMode.isActive ? () => {} : handleAddPatient}
                    onUpdatePatient={mirrorMode.isActive ? () => {} : handleUpdatePatient}
                    onDeletePatient={mirrorMode.isActive ? () => {} : handleDeletePatient}
                    onCreateAppointment={mirrorMode.isActive ? () => {} : handleCreateAppointmentForPatient}
                />
              );
          case 'reports':
              return (
                  <ReportsView appointments={filteredAppointments} />
              );
          default:
              return null;
      }
  };

  // AutoLoginHandler: processa magic links do Supabase para login automático
  const handleAutoLogin = (loggedInUser: User) => {
      handleLogin(loggedInUser, false);
  };

  // Função para ativar modo mirror (visualizar como outro usuário)
  const handleStartMirrorMode = async (userId: string, userName: string, userEmail: string) => {
      setMirrorMode({
          isActive: true,
          userId,
          userName,
          userEmail
      });
      setIsAdminPanelOpen(false); // Fechar modal de admin
      setCurrentView('calendar'); // Iniciar na visualização de calendário
      // Carregar dados do usuário será feito pelo useEffect abaixo
  };

  // Função para desativar modo mirror (voltar ao admin)
  const handleStopMirrorMode = () => {
      setMirrorMode({
          isActive: false,
          userId: null,
          userName: null,
          userEmail: null
      });
      setCurrentView('calendar');
      // Limpar dados (admin não tem dados próprios)
      setAppointments([]);
      setPatients([]);
      setDoctors([]);
      setNotifications([]);
      setSelectedAppointment(null);
      setIsCreateModalOpen(false);
      setEditingAppointment(null);
  };

  // Recarregar dados quando mirror mode mudar
  useEffect(() => {
      if (mirrorMode.isActive && mirrorMode.userId && user) {
          console.log('[useEffect] Mirror mode ativado, carregando dados do usuário:', mirrorMode.userId);
          // Quando entrar no mirror mode, carregar dados do usuário visualizado
          // Passamos o mirrorMode.userId explicitamente para garantir que seja usado
          loadData(mirrorMode.userId, false);
      } else if (!mirrorMode.isActive && user?.isAdmin && user.id === 'proton_admin_master') {
          console.log('[useEffect] Saindo do mirror mode, limpando dados');
          // Se sair do mirror mode e for admin, limpar dados
          setAppointments([]);
          setPatients([]);
          setDoctors([]);
          setNotifications([]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorMode.isActive, mirrorMode.userId, user?.id]);

  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
      );
  }

  // --- Render Login if not authenticated ---
  if (!user) {
      return (
          <>
              <AutoLoginHandler onAutoLogin={handleAutoLogin} />
              <LoginScreen onLogin={handleLogin} />
          </>
      );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50/50 overflow-hidden font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar 
        user={mirrorMode.isActive ? {
            ...user!,
            name: mirrorMode.userName || user!.name,
            email: mirrorMode.userEmail || user!.email,
            clinicName: 'Visualizando como usuário'
        } : user}
        onCreateClick={handleCreateClick} 
        currentView={currentView}
        onViewChange={setCurrentView}
        doctors={doctors}
        onToggleDoctor={handleToggleDoctor}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        isReadOnly={mirrorMode.isActive}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Banner de Mirror Mode */}
        {mirrorMode.isActive && (
            <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        Visualizando como: <strong>{mirrorMode.userEmail}</strong>
                    </span>
                    <span className="text-xs opacity-75">(Modo espelho - apenas visualização)</span>
                </div>
                <button
                    onClick={handleStopMirrorMode}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Admin
                </button>
            </div>
        )}

        <Header 
            user={mirrorMode.isActive ? {
                ...user!,
                name: mirrorMode.userName || user!.name,
                email: mirrorMode.userEmail || user!.email
            } : user}
            currentDate={currentDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            notifications={notifications}
            onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
            onClearNotifications={() => setNotifications([])}
        />
        
        <main className="flex-1 overflow-hidden relative">
            {renderContent()}
        </main>
      </div>

      {selectedAppointment && (
        <AppointmentDetails 
            appointment={selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
            onUpdateStatus={mirrorMode.isActive ? undefined : handleUpdateAppointmentStatus}
            onEdit={mirrorMode.isActive ? undefined : handleEditClick}
        />
      )}

      {isCreateModalOpen && (
        <CreateAppointmentModal 
            initialData={editingAppointment}
            tags={tags}
            patients={patients}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onClose={() => {
                setIsCreateModalOpen(false);
                setEditingAppointment(null);
            }}
            onSave={handleSaveAppointment}
        />
      )}

      {isSettingsOpen && (
          <SettingsModal 
            onClose={() => setIsSettingsOpen(false)}
            doctors={doctors}
            onAddDoctor={handleAddDoctor}
            onRemoveDoctor={handleRemoveDoctor}
          />
      )}

      {user?.isAdmin && (
          <UsersManagementModal 
            isOpen={isAdminPanelOpen}
            onClose={() => setIsAdminPanelOpen(false)}
            currentUser={user}
            onStartMirrorMode={handleStartMirrorMode}
          />
      )}
    </div>
  );
};

export default App;
