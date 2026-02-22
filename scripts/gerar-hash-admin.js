#!/usr/bin/env node
/**
 * Gera hash bcrypt para ADMIN_PASSWORD_HASH (login Admin Master do Proton).
 *
 * Uso:
 *   node scripts/gerar-hash-admin.js "SuaSenhaSegura123"
 *
 * Depois:
 * 1. Copie o hash gerado e cole na variável ADMIN_PASSWORD_HASH no Railway (Proton).
 * 2. Faça login no Proton com o e-mail de admin (ex.: mauro.zanelato@gmail.com) e a SENHA em texto que você digitou acima (não o hash).
 */

const bcrypt = require('bcrypt');

const senha = process.argv[2];
if (!senha) {
  console.error('Uso: node scripts/gerar-hash-admin.js "SuaSenhaAqui"');
  console.error('Exemplo: node scripts/gerar-hash-admin.js "MinhaSenhaAdmin123"');
  process.exit(1);
}

const rounds = 10;
bcrypt.hash(senha, rounds).then((hash) => {
  console.log('\n--- Hash gerado (copie para ADMIN_PASSWORD_HASH) ---\n');
  console.log(hash);
  console.log('\n--- Lembrete ---');
  console.log('1. Cole o hash acima na variável ADMIN_PASSWORD_HASH no Railway.');
  console.log('2. No login do Proton, use sua SENHA em texto ("' + senha + '"), não o hash.');
  console.log('');
}).catch((err) => {
  console.error('Erro ao gerar hash:', err.message);
  process.exit(1);
});
