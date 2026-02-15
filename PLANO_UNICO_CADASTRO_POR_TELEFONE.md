# Plano: Um único cadastro por telefone no Proton

**Objetivo:** Garantir que a mesma pessoa (mesmo número de telefone) seja sempre tratada como um único paciente no Proton, mesmo quando o SDR envia nomes diferentes ("Mauro", "Mauro Zanelato", etc.). Evitar duplicação de clientes e unificar histórico de agendamentos.

**Referência:** Boas práticas de CRM – usar telefone como critério de identidade, normalizar formato (E.164), checar duplicata no ponto de entrada e consolidar registros existentes quando necessário.

---

## 1. Causa do problema atual

- O SDR envia **nome** e **telefone** para o Proton ao criar agendamento. O nome varia conforme a mensagem do usuário: às vezes só o primeiro nome ("Mauro"), às vezes nome completo ("Mauro Zanelato").
- O Proton usa **findOrCreatePatient(name, phone, userId)** buscando por `phone` e `user_id`. Se o **telefone chegar em formatos diferentes** (ex.: `554388466446` vs `4388466446` ou `43 8846-6446`), a busca não encontra o paciente existente e cria outro.
- Mesmo com o mesmo telefone normalizado, o código **não atualiza o nome** do paciente quando encontra um existente; só retorna o existente. Ou seja, o primeiro nome que "ganhou" (ex.: "Mauro") fica fixo, e novos agendamentos com "Mauro Zanelato" ainda assim podem ter gerado outro paciente se na época o telefone veio em formato diferente.
- **Resultado:** vários registros na lista de Clientes (Mauro, Mauro Zanelato, etc.) para a mesma pessoa e mesmo telefone.

---

## 2. Princípio adotado

- **Telefone normalizado (E.164)** é o identificador de unicidade do paciente dentro de cada estabelecimento (`user_id`).
- **Um telefone + um user_id = um único paciente.** Novos agendamentos com esse telefone devem reutilizar o mesmo paciente e, quando fizer sentido, enriquecer o nome (ex.: preferir nome mais completo).

---

## 3. Alterações propostas

### 3.1 Normalizar telefone ao buscar/criar paciente (Proton)

**Arquivo:** `Proton-agendamento/api/create-appointment.js`

**O quê:**

- Antes de chamar `findOrCreatePatient(patientName, patientPhone, protonUserId)`:
  - Normalizar `patientPhone` para E.164 (apenas dígitos; se 10 ou 11 dígitos, prefixar `55`; aceitar 12–13 dígitos com `55`).
- Usar **sempre** o telefone normalizado na busca e na criação.

**Detalhe:** O Proton é Node/JS; não importa o `normalizePhoneNumber` do SDR (TypeScript). Implementar no próprio `create-appointment.js` uma função de normalização equivalente (ou receber o telefone já normalizado do SDR e apenas renormalizar no Proton para garantir). Recomendação: implementar normalização no Proton para ser independente do SDR.

**Regra de negócio:** Se o telefone não for normalizável (muito curto, inválido), rejeitar a criação do agendamento com erro 400 (telefone inválido) em vez de criar paciente com telefone “sujo”.

---

### 3.2 Atualizar nome do paciente quando for “mais completo” (Proton)

**Arquivo:** `Proton-agendamento/api/create-appointment.js` – função `findOrCreatePatient` (ou lógica logo após ela).

**O quê:**

- Quando **já existir** paciente com o mesmo telefone (e `user_id`):
  - Comparar o **nome novo** (vindo do SDR) com o nome atual do paciente.
  - Se o nome novo for considerado “mais completo” que o atual, atualizar o registro do paciente com o nome novo (ex.: atual "Mauro" e novo "Mauro Zanelato" → atualizar para "Mauro Zanelato").
- Critério sugerido de “mais completo”: nome novo tem mais palavras (ex.: 2 ou mais) e é mais longo que o atual; ou nome atual está vazio/curto (ex.: uma palavra só) e o novo tem duas ou mais palavras. Evitar sobrescrever um nome completo com um apelido.

**Exemplo de regra simples:**

- Se `nomeNovo` tem mais de uma palavra e `nomeAtual` tem só uma → atualizar paciente com `nomeNovo`.
- Se `nomeNovo` tem mais caracteres que `nomeAtual` e não é substring do atual → atualizar com `nomeNovo`.
- Caso contrário, manter o nome atual (não sobrescrever com algo pior).

Assim, ao longo do tempo o cadastro tende a ficar com o nome mais completo que o usuário já informou.

---

### 3.3 Garantir envio de telefone normalizado pelo SDR (opcional mas recomendado)

**Arquivo:** `services/proton-integration.ts` (e, se aplicável, ponto que chama `scheduleAppointment` no orchestrator).

**O quê:**

- Antes de chamar a API do Proton (`create-appointment`), normalizar `params.patientPhone` com `normalizePhoneNumber` (já existente em `utils/appointment-message-formatter.ts`).
- Se a normalização retornar `null`, não chamar o Proton e retornar erro ao fluxo (ex.: “Telefone inválido para agendamento”).

**Benefício:** Reduz variação de formato que chega ao Proton e reforça a regra “um telefone = um paciente” mesmo que o Proton também normalize de novo.

---

### 3.4 Unificar duplicatas já existentes (script ou ferramenta)

**Objetivo:** Para cada `user_id` (estabelecimento), encontrar pacientes que compartilham o **mesmo telefone normalizado** e consolidar em um único cadastro.

**Passos sugeridos:**

1. **Listar pacientes** por `user_id` e normalizar o `phone` de cada um (mesma regra E.164).
2. **Agrupar** por `(user_id, phone_normalizado)`. Grupos com mais de um paciente = duplicatas.
3. **Escolher o paciente a manter** em cada grupo (ex.: o que tem mais agendamentos não cancelados, ou o que tem nome mais longo; em caso de empate, o mais antigo por `created_at`).
4. **Reatribuir** todos os `appointments` dos outros pacientes do grupo para o `patient_id` escolhido; atualizar também `patient_name` no appointment para o nome do paciente que ficou (opcional, para consistência na listagem).
5. **Atualizar** o registro do paciente que ficou com o “melhor” nome (ex.: o mais completo entre os do grupo), se ainda não estiver.
6. **Remover** os demais pacientes do grupo (após reassign dos appointments), ou marcar como inativo se houver coluna `active` em vez de deletar.

**Entrega:** Script one-shot (ex.: `scripts/merge-duplicate-patients-proton.ts` ou `.js`) que use Supabase (service role) e possa ser rodado manualmente ou por um admin. Opcional: endpoint protegido no Proton que dispara a mesma lógica (ex.: “Unificar duplicatas por telefone”).

**Segurança:** Fazer backup ou rodar primeiro em ambiente de teste; tratar apenas pacientes do mesmo `user_id` e com telefone normalizado idêntico.

---

### 3.5 Constraint de unicidade (opcional, para evitar regressão)

**Onde:** Migration no Proton (Supabase).

**O quê:**

- Adicionar **índice único** em `patients` para `(user_id, phone_normalizado)`.
- Para isso, pode ser necessário:
  - Adicionar coluna `phone_normalized` (TEXT) em `patients` e preenchê-la com a normalização do `phone` atual; em seguida criar `UNIQUE(user_id, phone_normalized)`.
  - Ou usar função única em `(user_id, normalizar(phone))` se o Supabase/Postgres suportar (menos portável).

**Alternativa:** Manter apenas a lógica em 3.1 e 3.2 (normalizar sempre e “find or create” por telefone normalizado) sem constraint, se não quiser migration agora. A constraint torna a regra “um telefone por user = um paciente” garantida no banco.

---

## 4. Ordem de implementação sugerida

| Ordem | Item | Onde | Observação |
|-------|-----|------|------------|
| 1 | Normalizar telefone antes de findOrCreatePatient | Proton `create-appointment.js` | Evita novas duplicatas por variação de formato. |
| 2 | Atualizar nome do paciente quando o novo for “mais completo” | Proton `findOrCreatePatient` (ou após) | Melhora progressivamente o nome do cadastro. |
| 3 | Normalizar patientPhone no SDR antes de chamar Proton | `proton-integration.ts` | Consistência e validação no SDR. |
| 4 | Script de merge de duplicatas por telefone | Novo script (SDR ou Proton) | Unifica cadastros já existentes (ex.: vários “Mauro”). |
| 5 | (Opcional) Coluna `phone_normalized` + UNIQUE | Migration Proton | Bloqueia duplicatas no banco. |

---

## 5. Resumo

- **Causa:** Telefone em formatos diferentes gera mais de um paciente; nome diferente sozinho não deveria, mas a variação de telefone sim. Além disso, o nome não era enriquecido quando já existia paciente.
- **Solução:** Tratar **telefone normalizado (E.164)** como chave de identidade por estabelecimento; **sempre** normalizar na criação/busca do paciente; **atualizar** o nome quando o novo for mais completo; **unificar** duplicatas existentes por script; e, se desejado, garantir unicidade no banco com `(user_id, phone_normalized)`.

Com isso, o Proton passa a manter um único cadastro por telefone (por estabelecimento), com nome evoluindo para o mais completo, e a lista de Clientes deixa de acumular “Mauro” e “Mauro Zanelato” como registros separados quando forem a mesma pessoa e o mesmo número.
