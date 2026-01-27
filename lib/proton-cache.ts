/**
 * Cache de dados do Proton usando IndexedDB
 * 
 * Estratégia (Fase 1 - Base Segura):
 * - Cache de Agenda Blocks (TTL: 1 hora)
 * - Cache de Doctors (TTL: 30 minutos)
 * - Fallback seguro: se IndexedDB falhar, funciona normalmente sem cache
 * 
 * Fase 2 (futuro):
 * - Cache de Patients (TTL: 10 minutos)
 * - Cache de Appointments (TTL: 5 minutos)
 */

import type { AgendaBlock } from '../services/api';
import type { DoctorProfile } from '../types';

// Tipos de cache disponíveis
type CacheType = 'agenda_blocks' | 'doctors' | 'patients' | 'appointments';

interface CachedData<T> {
    userId: string;
    data: T;
    timestamp: number; // Quando foi cacheado
    ttl: number; // Time to live em milissegundos
}

const DB_NAME = 'proton_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache_data';

// TTLs por tipo de cache (em milissegundos)
const TTL_BY_TYPE: Record<CacheType, number> = {
    agenda_blocks: 60 * 60 * 1000,      // 1 hora
    doctors: 30 * 60 * 1000,            // 30 minutos
    patients: 10 * 60 * 1000,           // 10 minutos (Fase 2)
    appointments: 5 * 60 * 1000,        // 5 minutos (Fase 2)
};

class ProtonCache {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private isSupported: boolean;

    constructor() {
        // Verificar se IndexedDB está disponível
        this.isSupported = typeof indexedDB !== 'undefined';
        
        if (!this.isSupported) {
            console.warn('⚠️ [ProtonCache] IndexedDB não suportado, cache desabilitado');
        }
    }

    /**
     * Inicializa o banco de dados IndexedDB
     * Retorna uma promise que resolve quando o DB está pronto
     */
    private async init(): Promise<void> {
        if (!this.isSupported) {
            return;
        }

        if (this.db) {
            return; // Já inicializado
        }

        if (this.initPromise) {
            return this.initPromise; // Já está inicializando
        }

        this.initPromise = new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => {
                    console.error('❌ [ProtonCache] Erro ao abrir IndexedDB:', request.error);
                    this.initPromise = null;
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('✅ [ProtonCache] IndexedDB inicializado');
                    this.initPromise = null;
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    
                    // Criar object store se não existir
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        // Usar keyPath composto para permitir múltiplos tipos de cache por usuário
                        const store = db.createObjectStore(STORE_NAME, { keyPath: ['type', 'userId'] });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                        store.createIndex('type', 'type', { unique: false });
                        store.createIndex('userId', 'userId', { unique: false });
                        console.log('✅ [ProtonCache] Object store criado');
                    }
                };
            } catch (error) {
                console.error('❌ [ProtonCache] Erro ao inicializar:', error);
                this.initPromise = null;
                reject(error);
            }
        });

        return this.initPromise;
    }

    /**
     * Obtém dados do cache
     * Retorna null se não encontrar, expirado ou se houver erro
     */
    async get<T>(type: CacheType, userId: string): Promise<T | null> {
        if (!this.isSupported) {
            return null;
        }

        try {
            await this.init();
            
            if (!this.db) {
                return null;
            }

            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                // Buscar usando chave composta [type, userId]
                const request = store.get([type, userId]);

                request.onsuccess = () => {
                    const result = request.result;
                    // Se não encontrou, retornar null
                    if (!result) {
                        console.log(`ℹ️ [ProtonCache] Cache miss para ${type} (userId: ${userId})`);
                        resolve(null);
                        return;
                    }
                    
                    // Estrutura salva: { type, userId, data, timestamp, ttl }
                    const cached = result as { type: CacheType; userId: string; data: T; timestamp: number; ttl: number };
                    
                    if (!cached || !cached.data) {
                        console.log(`ℹ️ [ProtonCache] Cache miss para ${type} (userId: ${userId})`);
                        resolve(null);
                        return;
                    }

                    // Verificar se expirou (TTL)
                    const now = Date.now();
                    const age = now - cached.timestamp;
                    const ttl = cached.ttl || TTL_BY_TYPE[type];

                    if (age > ttl) {
                        console.log(`⏰ [ProtonCache] Cache expirado para ${type} (idade: ${Math.round(age / 1000)}s, TTL: ${Math.round(ttl / 1000)}s)`);
                        // Remover do cache automaticamente
                        this.invalidate(type, userId).catch(() => {});
                        resolve(null);
                        return;
                    }

                    console.log(`✅ [ProtonCache] Cache hit para ${type} (userId: ${userId}, idade: ${Math.round(age / 1000)}s)`);
                    // Retornar dados do cache
                    resolve(cached.data);
                };

                request.onerror = () => {
                    console.warn(`⚠️ [ProtonCache] Erro ao ler cache para ${type}:`, request.error);
                    resolve(null); // Fallback: retorna null (busca normal)
                };
            });
        } catch (error) {
            console.warn(`⚠️ [ProtonCache] Erro ao acessar cache para ${type}:`, error);
            return null; // Fallback seguro
        }
    }

    /**
     * Salva dados no cache
     * Não lança erro se falhar (fallback seguro)
     */
    async set<T>(type: CacheType, userId: string, data: T): Promise<void> {
        if (!this.isSupported) {
            return;
        }

        try {
            await this.init();
            
            if (!this.db) {
                return;
            }

            const ttl = TTL_BY_TYPE[type];
            const now = Date.now();
            
            // Estrutura para salvar no IndexedDB (com chave composta)
            const cacheEntry = {
                type,
                userId,
                data,
                timestamp: now,
                ttl
            };

            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                // Salvar com chave composta [type, userId]
                const request = store.put(cacheEntry);

                request.onsuccess = () => {
                    const dataLength = Array.isArray(data) ? data.length : 1;
                    console.log(`✅ [ProtonCache] ${type} salvo no cache (userId: ${userId}, itens: ${dataLength})`);
                    resolve();
                };

                request.onerror = () => {
                    console.warn(`⚠️ [ProtonCache] Erro ao salvar cache para ${type}:`, request.error);
                    resolve(); // Não falha, apenas loga
                };
            });
        } catch (error) {
            console.warn(`⚠️ [ProtonCache] Erro ao salvar no cache para ${type}:`, error);
            // Não lança erro - fallback seguro
        }
    }

    /**
     * Remove dados do cache (invalidação)
     */
    async invalidate(type: CacheType, userId: string): Promise<void> {
        if (!this.isSupported || !this.db) {
            return;
        }

        try {
            await this.init();
            
            if (!this.db) {
                return;
            }

            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete([type, userId]);

                request.onsuccess = () => {
                    console.log(`🗑️ [ProtonCache] Cache invalidado para ${type} (userId: ${userId})`);
                    resolve();
                };

                request.onerror = () => {
                    console.warn(`⚠️ [ProtonCache] Erro ao invalidar cache para ${type}:`, request.error);
                    resolve(); // Não falha
                };
            });
        } catch (error) {
            console.warn(`⚠️ [ProtonCache] Erro ao invalidar cache para ${type}:`, error);
        }
    }

    /**
     * Limpa todo o cache de um usuário (útil para logout)
     */
    async clearUser(userId: string): Promise<void> {
        if (!this.isSupported || !this.db) {
            return;
        }

        try {
            await this.init();
            
            if (!this.db) {
                return;
            }

            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('type');
                const request = index.openCursor();

                let deleted = 0;
                const types: CacheType[] = ['agenda_blocks', 'doctors', 'patients', 'appointments'];

                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        const value = cursor.value as CachedData<any> & { type: CacheType };
                        if (value.userId === userId && types.includes(value.type)) {
                            cursor.delete();
                            deleted++;
                        }
                        cursor.continue();
                    } else {
                        if (deleted > 0) {
                            console.log(`🧹 [ProtonCache] Cache limpo para usuário ${userId} (${deleted} entradas removidas)`);
                        }
                        resolve();
                    }
                };

                request.onerror = () => {
                    console.warn(`⚠️ [ProtonCache] Erro ao limpar cache do usuário:`, request.error);
                    resolve();
                };
            });
        } catch (error) {
            console.warn('⚠️ [ProtonCache] Erro ao limpar cache do usuário:', error);
        }
    }

    /**
     * Limpa todo o cache (útil para debug ou reset)
     */
    async clear(): Promise<void> {
        if (!this.isSupported || !this.db) {
            return;
        }

        try {
            await this.init();
            
            if (!this.db) {
                return;
            }

            return new Promise((resolve) => {
                const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('🧹 [ProtonCache] Cache completamente limpo');
                    resolve();
                };

                request.onerror = () => {
                    console.warn('⚠️ [ProtonCache] Erro ao limpar cache:', request.error);
                    resolve();
                };
            });
        } catch (error) {
            console.warn('⚠️ [ProtonCache] Erro ao limpar cache:', error);
        }
    }
}

// Singleton - uma única instância do cache
export const protonCache = new ProtonCache();
