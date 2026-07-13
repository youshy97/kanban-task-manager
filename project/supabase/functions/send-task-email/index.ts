import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// SECURITY NOTE (see migration audit, step 1):
// This function was previously invoked with the public anon key as the
// Bearer token, meaning it had no way to identify the caller and every
// field it used (including the recipient's own email address) came
// straight from client input. This rewrite:
//   1. Requires the caller's real session JWT (forwarded from the
//      browser's `supabase.auth.getSession().access_token`, NOT the anon
//      key — see the corresponding fix in src/lib/hooks.ts assignTask()).
//   2. Resolves the caller's role server-side and requires manager+,
//      mirroring the `assign_task` permission in src/lib/rbac.ts, instead
//      of trusting that only the UI enforces this.
//   3. Re-fetches the task and assignee from the database using the
//      caller's own (RLS-scoped) client rather than trusting client-
//      supplied taskName/employeeName/`to` fields — so a caller can only
//      ever trigger an email about a task+assignee pair that actually
//      exists and that they're actually allowed to see.
//
// NOTE ON SCOPE: this migration/rewrite closes the *authorization* gap.
// Actual outbound email delivery (wiring a real provider instead of
// console.log) is intentionally still a no-op here — that's Step 3
// (email assignment workflow) in the review plan, done as a separate,
// reviewable change.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLE_RANK: Record<string, number> = {
  super_admin: 5,
  admin: 4,
  manager: 3,
  employee: 2,
  viewer: 1,
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("send-task-email: missing SUPABASE_URL/SUPABASE_ANON_KEY env vars");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  // Client scoped to the CALLER's own JWT (forwarded, not the anon key).
  // This means every query below runs under the caller's own RLS
  // context — they can never read a task or profile they wouldn't
  // otherwise be allowed to see.
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }
  const callerId = userData.user.id;

  const { data: callerProfile, error: profileErr } = await callerClient
    .from("profiles")
    .select("role, full_name")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return jsonResponse({ error: "Caller profile not found" }, 403);
  }
  if ((ROLE_RANK[callerProfile.role] ?? 0) < ROLE_RANK.manager) {
    return jsonResponse({ error: "Insufficient permissions to send task-assignment emails" }, 403);
  }

  let payload: { taskId?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { taskId } = payload;
  if (!taskId || typeof taskId !== "string") {
    return jsonResponse({ error: "taskId is required" }, 400);
  }

  // Re-derive everything server-side from the DB rather than trusting
  // client-supplied taskName/priority/employeeName/assignerName/to — the
  // client can request "send the assignment email for task X", but cannot
  // dictate what that email says or who it goes to.
  const { data: task, error: taskErr } = await callerClient
    .from("tasks")
    .select("id, title, priority, assigned_to")
    .eq("id", taskId)
    .maybeSingle();

  if (taskErr || !task) {
    return jsonResponse({ error: "Task not found" }, 404);
  }
  if (!task.assigned_to) {
    return jsonResponse({ error: "Task has no assignee" }, 400);
  }

  const { data: assignee, error: assigneeErr } = await callerClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", task.assigned_to)
    .maybeSingle();

  if (assigneeErr || !assignee) {
    return jsonResponse({ error: "Assignee not found" }, 404);
  }

  const priorityLabel =
    task.priority === "critical" ? "Critical" :
    task.priority === "high" ? "High" :
    task.priority === "medium" ? "Medium" :
    task.priority === "low" ? "Low" : "Medium";

  const subject = "New Task Assigned";
  const body = `Dear ${assignee.full_name},

The following task has been assigned to you:

Task Name: ${task.title}
Priority: ${priorityLabel}

Please review the task and start execution as soon as possible.

Thank you,
${callerProfile.full_name}`;

  // Delivery is still a no-op placeholder — see the scope note at the top
  // of this file. Wiring a real provider is Step 3.
  console.log("Email notification:", { to: assignee.email, subject, body });

  return jsonResponse({ success: true, to: assignee.email, subject }, 200);
});
