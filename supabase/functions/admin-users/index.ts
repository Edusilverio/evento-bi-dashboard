import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: Deno.env.get("CM_DB_SCHEMA") ?? "public" } });

    // Verify the caller using getClaims
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { db: { schema: Deno.env.get("CM_DB_SCHEMA") ?? "public" },
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");

    const callerId = claimsData.claims.sub as string;

    // Check admin role using service role client
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Forbidden: admin role required");

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_users": {
        const { client_id } = params;
        let query = supabase
          .from("profiles")
          .select("id, email, full_name, is_active, created_at, last_login, client_id")
          .order("created_at", { ascending: false });

        if (client_id) {
          query = query.eq("client_id", client_id);
        }

        const { data: profiles } = await query;

        const { data: roles } = await supabase.from("user_roles").select("user_id, role");
        const roleMap: Record<string, string> = {};
        (roles || []).forEach((r: any) => {
          if (r.role === "admin") roleMap[r.user_id] = "admin";
          else if (!roleMap[r.user_id]) roleMap[r.user_id] = r.role;
        });

        const users = (profiles || []).map((p: any) => ({
          ...p,
          role: roleMap[p.id] || "client",
        }));

        return new Response(JSON.stringify({ data: users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_user": {
        const { email, password, full_name, role, client_id } = params;
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, app: Deno.env.get("CM_APP_ID") ?? "painel" },
        });
        if (createErr) throw createErr;

        if (newUser.user) {
          await supabase.from("user_roles").delete().eq("user_id", newUser.user.id);
          await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: role || "client" });
        }
        if (client_id && newUser.user) {
          await supabase.from("profiles").update({ client_id }).eq("id", newUser.user.id);
        }

        return new Response(JSON.stringify({ data: newUser }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle_active": {
        const { user_id, is_active } = params;
        const { error } = await supabase.from("profiles").update({ is_active }).eq("id", user_id);
        if (error) throw error;
        if (!is_active) {
          await supabase.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
        } else {
          await supabase.auth.admin.updateUserById(user_id, { ban_duration: "none" });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        const { email } = params;
        const { error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        const { user_id } = params;
        const { error } = await supabase.auth.admin.deleteUser(user_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_role": {
        const { user_id, role } = params;
        await supabase.from("user_roles").delete().eq("user_id", user_id);
        await supabase.from("user_roles").insert({ user_id, role });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_password": {
        const { user_id, password } = params;
        const { error } = await supabase.auth.admin.updateUserById(user_id, { password });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_whatsapp": {
        const { client_id } = params;
        const { data, error } = await supabase
          .from("client_whatsapp_numbers")
          .select("*")
          .eq("client_id", client_id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add_whatsapp": {
        const { client_id, phone_number, label } = params;
        const { data, error } = await supabase
          .from("client_whatsapp_numbers")
          .insert({ client_id, phone_number, label: label || "" })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_whatsapp": {
        const { id } = params;
        const { error } = await supabase.from("client_whatsapp_numbers").delete().eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("Admin users error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === "Forbidden: admin role required" ? 403 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
