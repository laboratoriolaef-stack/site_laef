
import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";

// ======================================
// CONFIGURAÇÃO DO SUPABASE — LAEF
// ======================================

const SUPABASE_URL = "https://irorrnxpwkomnglxbkul.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_86_zMqwLvqOMuoG1oMPJtQ_z33CW5f4";

// ======================================
// CONEXÃO
// ======================================

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
