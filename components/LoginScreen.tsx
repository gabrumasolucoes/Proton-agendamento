
import React, { useState } from 'react';
import { CalendarClock, ArrowRight, Lock, Mail, User, Building2, Sparkles, CheckCircle2, MessageCircle, Zap, AlertTriangle, Settings, Save, X, KeyRound, Database, Copy, ShieldCheck } from 'lucide-react';
import { User as UserType } from '../types';
import { apiAuth } from '../services/api';

interface LoginScreenProps {
  onLogin: (user: UserType, isDemo: boolean) => void;
}

// SQL Script constant for easy copying
const SQL_SCRIPT = `
-- 1. UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Profiles Table
create table if not exists profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text, name text, clinic_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- 3. Doctors Table
create table if not exists doctors (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null, specialty text, color text, active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table doctors enable row level security;
create policy "Users crud own doctors" on doctors for all using (auth.uid() = user_id);

-- 4. Patients Table
create table if not exists patients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null, phone text, email text, history text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table patients enable row level security;
create policy "Users crud own patients" on patients for all using (auth.uid() = user_id);

-- 5. Appointments Table
create table if not exists appointments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  patient_id text, patient_name text, doctor_id text, title text,
  start_time timestamp with time zone, end_time timestamp with time zone,
  status text, notes text, source text, tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table appointments enable row level security;
create policy "Users crud own appointments" on appointments for all using (auth.uid() = user_id);

-- 6. Trigger for New User Profile
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name, clinic_name)
  values (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'clinic_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
`;

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Config Modal State
  const [showConfig, setShowConfig] = useState(false);
  
  // Default URL/Key pre-filled from code or localStorage
  const [configUrl, setConfigUrl] = useState(localStorage.getItem('proton_supabase_url') || 'https://kxxasmvsfxbbauepeiyn.supabase.co');
  const [configKey, setConfigKey] = useState(localStorage.getItem('proton_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFzbXZzZnhiYmF1ZXBlaXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjUxMDEsImV4cCI6MjA4MTQ0MTEwMX0.0kf2DF0qpC74J4vonTywDwHoPhdegzqjkMU1P_MvefY');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // --- LOGIN ADMIN MASTER ---
    // Verificar se é um email de admin master antes de tentar login normal
    const adminMasterEmails = ['mauro.zanelato@gmail.com', 'gabrumasolucoes@gmail.com'];
    const isAdminMasterEmail = adminMasterEmails.some(adminEmail => 
        email.toLowerCase().trim() === adminEmail.toLowerCase()
    );

    if (isAdminMasterEmail && !isRegistering) {
        try {
            // Tentar login admin master via API
            const response = await fetch('/api/auth-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Login admin master bem-sucedido
                const adminUser: UserType = {
                    id: 'proton_admin_master',
                    name: data.user.name,
                    email: data.user.email,
                    clinicName: 'Admin Master Proton',
                    role: 'admin',
                    isAdmin: true,
                    allUsers: data.allUsers || []
                };
                onLogin(adminUser, false); // false = não é demo
                return;
            } else {
                // Se falhar, continuar com login normal (para compatibilidade)
                console.warn('⚠️ [Login] Falha no login admin master, tentando login normal...');
            }
        } catch (adminError: any) {
            console.warn('⚠️ [Login] Erro ao tentar login admin master:', adminError);
            // Continuar com login normal
        }
    }
    // -----------------------------

    // --- BYPASS DE ADMIN LOCAL (DEMO) ---
    if (email === 'admin@proton.com' && password === 'admin123') {
        setTimeout(() => {
            const adminUser: UserType = {
                id: 'local_admin',
                name: 'Administrador Local',
                email: 'admin@proton.com',
                clinicName: 'Clínica Proton'
            };
            onLogin(adminUser, true); 
        }, 500);
        return;
    }
    // -----------------------------

    try {
        if (isRegistering) {
            const { data, error } = await apiAuth.signUp(email, password, name, clinicName);
            if (error) throw error;
            
            // Verifica se o Supabase retornou uma sessão válida
            if (data.session) {
                // Auto login after signup (Email Confirm OFF)
                const user: UserType = {
                    id: data.user!.id,
                    name: name,
                    email: email,
                    clinicName: clinicName
                };
                onLogin(user, false);
            } else if (data.user && !data.session) {
                // Usuário criado, mas precisa confirmar email
                setSuccessMsg("Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.");
                setIsRegistering(false); // Volta para tela de login
            }
        } else {
            const { data, error } = await apiAuth.signIn(email, password);
            if (error) throw error;
            
            // Get profile info
            const user = await apiAuth.getCurrentUser();
            if (user) {
                onLogin(user, false);
            }
        }
    } catch (err: any) {
        console.error(err);
        let msg: string | React.ReactNode = err.message;
        
        // Tradução de erros comuns do Supabase
        if (typeof msg === 'string' && msg === 'Invalid login credentials') {
             msg = (
                 <span>
                    E-mail ou senha incorretos.<br/><br/>
                    <strong>Dica Importante:</strong> Se você acabou de criar a conta e desativou a confirmação de e-mail <em>depois</em>, sua conta antiga está "travada" esperando confirmação.<br/>
                    Vá no painel do Supabase (Auth &gt; Users), delete este usuário e crie novamente aqui.
                 </span>
             );
        }
        if (typeof msg === 'string' && msg.includes('Email not confirmed')) msg = 'E-mail não confirmado. Verifique sua caixa de entrada ou desative a opção "Confirm Email" em Authentication -> Providers -> Email no Supabase.';
        if (typeof msg === 'string' && (msg.includes('Load failed') || msg.includes('Failed to fetch'))) msg = 'Erro de conexão. Verifique sua internet ou as chaves do Supabase.';
        
        setError(msg);
    } finally {
        setLoading(false);
    }
  };

  const handleFillDemo = () => {
      setIsRegistering(false);
      setEmail('admin@proton.com');
      setPassword('admin123');
      // Pequeno hack para submeter automaticamente após preencher
      setTimeout(() => {
        const btn = document.getElementById('login-btn');
        if (btn) btn.click();
      }, 100);
  };

  const handleSaveConfig = () => {
      localStorage.setItem('proton_supabase_url', configUrl.trim());
      localStorage.setItem('proton_supabase_key', configKey.trim());
      window.location.reload(); 
  };

  const copySqlToClipboard = () => {
      navigator.clipboard.writeText(SQL_SCRIPT);
      alert('Código SQL copiado! Cole no "SQL Editor" do painel do Supabase.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Settings Button */}
      <button 
        onClick={() => setShowConfig(true)}
        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 z-50"
        title="Configurar Conexão"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Config Modal */}
      {showConfig && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-800">Conexão com Banco de Dados</h3>
                      <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                      {/* Connection Settings */}
                      <div className="space-y-4">
                          <p className="text-sm text-slate-500">
                              Credenciais da API do Supabase.
                          </p>
                          <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Project URL</label>
                              <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-500"
                                value={configUrl}
                                onChange={e => setConfigUrl(e.target.value)}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Anon Public Key</label>
                              <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="eyJ..."
                                value={configKey}
                                onChange={e => setConfigKey(e.target.value)}
                              />
                          </div>
                      </div>

                      {/* SQL Setup Helper */}
                      <div className="border-t border-slate-100 pt-6">
                          <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                             <Database className="w-4 h-4 text-indigo-500" />
                             Configuração das Tabelas
                          </h4>
                          <p className="text-xs text-slate-500 mb-4">
                             Se este é seu primeiro acesso, você precisa criar as tabelas no Supabase. Copie o código abaixo e execute no "SQL Editor" do painel.
                          </p>
                          
                          <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                              <div className="bg-slate-800 px-3 py-2 flex justify-between items-center border-b border-slate-700">
                                  <span className="text-[10px] text-slate-400 font-mono">setup_db.sql</span>
                                  <button 
                                    onClick={copySqlToClipboard}
                                    className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-medium"
                                  >
                                      <Copy className="w-3 h-3" /> Copiar SQL
                                  </button>
                              </div>
                              <div className="p-3 overflow-x-auto">
                                  <pre className="text-[10px] text-slate-300 font-mono leading-relaxed opacity-70">
                                      {SQL_SCRIPT.substring(0, 150)}...
                                  </pre>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 mt-4">
                      <button 
                        onClick={handleSaveConfig}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                          <Save className="w-4 h-4" />
                          Salvar e Reiniciar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-200/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl flex w-full max-w-5xl overflow-hidden relative z-10 min-h-[600px]">
        
        {/* Left Side - Brand & Info */}
        <div className="hidden md:flex w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 z-0"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <CalendarClock className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Proton</h1>
              </div>

              <div className="space-y-8">
                <h2 className="text-3xl font-bold leading-tight">
                  Gestão inteligente para profissionais da saúde.
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Conecte sua agenda ao seu Chatbot e receba leads e agendamentos prontos automaticamente.
                </p>

                <div className="space-y-6 pt-4">
                  <div className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 transition-colors">
                      <MessageCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Centralização de Leads</h4>
                      <p className="text-sm text-slate-400">Receba automaticamente os pacientes captados no WhatsApp.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 group">
                     <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 transition-colors">
                      <Zap className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Agenda Automática</h4>
                      <p className="text-sm text-slate-400">Seu bot preenche seus horários livres 24/7.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 transition-colors">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Inteligência Proton</h4>
                      <p className="text-sm text-slate-400">Análise de perfil e preparo clínico antes da consulta.</p>
                    </div>
                  </div>
                </div>
              </div>
           </div>

           <div className="relative z-10 text-xs text-slate-500 mt-8">
             © 2024 Proton Systems. Todos os direitos reservados.
           </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
          
          <div className="max-w-sm mx-auto w-full">
            
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {isRegistering ? 'Crie sua conta' : 'Bem-vindo de volta'}
            </h3>
            <p className="text-slate-500 mb-8">
              {isRegistering 
                ? 'Comece a gerenciar sua clínica hoje mesmo.' 
                : 'Acesse sua conta para continuar.'}
            </p>

            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl mb-6 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl mb-6 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">{error}</div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        required 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="Dr. Exemplo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Nome da Clínica</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        required 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="Ex: Clínica Saúde"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">E-mail Profissional</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input 
                    type="email" 
                    required 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="voce@clinica.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input 
                    type="password" 
                    required 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                id="login-btn"
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    {isRegistering ? 'Criar Conta' : 'Entrar na Plataforma'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            
            {/* ADMIN DEMO HELPER */}
            <div className="mt-6 mb-2">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-800" />
                        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Acesso Rápido (Demo)</span>
                    </div>
                    <p className="text-[11px] text-indigo-600 mb-2 leading-tight">Use o acesso de administrador para testar o sistema sem precisar criar uma conta nova.</p>
                    <button 
                        type="button" 
                        onClick={handleFillDemo}
                        className="text-xs font-bold bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors shadow-sm w-full"
                    >
                        Preencher Login Admin
                    </button>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <div className="text-center">
                <p className="text-sm text-slate-500">
                  {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem acesso?'}
                  <button 
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setError(null);
                        setSuccessMsg(null);
                    }}
                    className="ml-2 font-bold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    {isRegistering ? 'Fazer Login' : 'Criar Conta'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
