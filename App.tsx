
import React, { useState, useEffect } from 'react';
import { addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from 'date-fns';
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
          // Se for admin master, carregar dados de todos os usuários
          if (user?.isAdmin && userId === 'proton_admin_master') {
              // Admin master não carrega dados normais, apenas verá gerenciamento
              setAppointments([]);
              setPatients([]);
              setDoctors([]);
              setNotifications([]);
              setLoading(false);
              return;
          }

          const [apts, pts, docs] = await Promise.all([
              apiData.getAppointments(userId, isDemo),
              apiData.getPatients(userId, isDemo),
              apiData.getDoctors(userId, isDemo)
          ]);

          setAppointments(apts);
          setPatients(pts);
          
          if (docs.length === 0 && !isDemo) {
               // Create initial doctor if none exists for new user
               const newDoc = await apiData.saveDoctor({
                   name: user?.name || 'Médico Principal',
                   specialty: 'Geral',
                   color: '#3b82f6',
                   active: true
               }, userId, isDemo);
               setDoctors([newDoc]);
          } else {
              setDoctors(docs);
          }

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
            const savedP = await apiData.savePatient(newPatientObj, user.id, isDemoMode);
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

    const savedApt = await apiData.saveAppointment(appointmentToSave, user.id, isDemoMode);
    
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
      const doctor = doctors.find(d => d.id === apt.doctorId);
      if (doctor && !doctor.active) return false;
      return true;
  });

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
                />
              );
          case 'patients':
              return (
                <PatientsView 
                    patients={patients}
                    appointments={filteredAppointments} 
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onAddPatient={handleAddPatient}
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onCreateAppointment={handleCreateAppointmentForPatient}
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
        user={user}
        onCreateClick={handleCreateClick} 
        currentView={currentView}
        onViewChange={setCurrentView}
        doctors={doctors}
        onToggleDoctor={handleToggleDoctor}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
            user={user}
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
            onUpdateStatus={handleUpdateAppointmentStatus}
            onEdit={handleEditClick}
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
          />
      )}
    </div>
  );
};

export default App;
