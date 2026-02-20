-- Migration 015: RLS para business_hours (acesso por user_id = auth.uid())
-- Permite que o usuário Proton leia e edite apenas seus próprios horários.

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business_hours"
  ON business_hours FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business_hours"
  ON business_hours FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business_hours"
  ON business_hours FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own business_hours"
  ON business_hours FOR DELETE
  USING (auth.uid() = user_id);
