# Horário e timezone: SDR → Proton

## Problema (horário errado na confirmação)

- **Sintoma:** Usuário pedia "14h", a confirmação do Proton mostrava "11:00".
- **Causa:** O SDR enviava `dateTime` sem timezone (ex: `"2026-01-29 14:00"`). O servidor do Proton (Node em UTC, ex: Railway) interpreta isso como **hora local do servidor** = 14:00 **UTC**. 14:00 UTC = 11:00 BRT, daí o horário errado na mensagem.

## Convenção acordada

1. **SDR** envia `dateTime` em **ISO com timezone Brasil**: `"2026-01-29T14:00:00-03:00"` (14h em Brasília).
2. **Proton** recebe, faz `new Date(dateTime)` (correto em qualquer ambiente), grava `start_time`/`end_time` em UTC no banco e, ao montar a mensagem de confirmação, **sempre** usa `timeZone: 'America/Sao_Paulo'` para exibir data e hora em BRT.

## Correções já feitas

### No App-SDR (este repositório)

- **`lib/scheduling-orchestrator.ts`**: `buildDateTimeForProton(collectedData)` monta `dateTime` em ISO com `-03:00` antes de chamar `processAppointmentFunction`. Ex: `"2026-01-29T14:00:00-03:00"`.

### No Proton-agendamento (esta pasta)

- **`api/create-appointment.js`**:
  - Recebe `dateTime` (ISO com ou sem timezone).
  - `new Date(dateTime)` interpreta corretamente (ex: `-03:00` = BRT).
  - Para a mensagem de confirmação e o objeto `appointment` retornado, data e hora são formatadas com `timeZone: 'America/Sao_Paulo'` em **toLocaleDateString** e **toLocaleTimeString**, sem usar o truque `startDateBRT` (que dependia do TZ do servidor). Assim a exibição fica sempre em BRT.

### check-availability.js

- Geração de slots usa offset Brasília (UTC-3) para converter horário local para UTC ao montar `dateTime` dos slots (`BRASILIA_OFFSET_HOURS = 3`).

## Formato esperado do SDR

- **Recomendado:** `"YYYY-MM-DDTHH:mm:ss-03:00"` (ex: `"2026-01-29T14:00:00-03:00"`).
- **Alternativa:** Qualquer string que `new Date(...)` aceite com timezone (ex: ISO 8601 com offset). Sem timezone, o Node interpreta como hora local do servidor (em produção muitas vezes UTC).

## Referência rápida

| Envio SDR              | Interpretação (servidor UTC) | Em BRT  |
|------------------------|-------------------------------|---------|
| `"2026-01-29 14:00"`   | 14:00 UTC                     | 11:00   |
| `"2026-01-29T14:00:00-03:00"` | 17:00 UTC (= 14:00 BRT) | 14:00   |
