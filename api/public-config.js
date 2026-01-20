/**
 * GET /api/public-config
 * Retorna SUPABASE_URL e SUPABASE_ANON_KEY para o frontend.
 * A Anon Key é pública por design e usada no client-side.
 * Permite que o frontend funcione sem VITE_* no build (config em runtime).
 */
function publicConfigHandler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    res.json({ supabaseUrl, supabaseAnonKey });
}

module.exports = publicConfigHandler;
