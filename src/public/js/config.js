/**
 * Category badge and styling configurations
 */
export const CATEGORY_CONFIG = {
  prompt_leak: {
    label: "Prompt Leak",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  data_exfiltration: {
    label: "Data Exfiltration",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  tool_misuse: {
    label: "Tool Misuse",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
};

/**
 * Classification verdict badge and label configurations
 */
export const VERDICT_CONFIG = {
  full_success: {
    label: "VULNERABILITY FOUND",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    icon: "shield-x",
  },
  partial_leak: {
    label: "PARTIAL LEAK",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: "alert-triangle",
  },
  full_block: {
    label: "DEFENDED (BLOCKED)",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: "shield-check",
  },
  off_topic: {
    label: "OFF TOPIC",
    badge: "bg-slate-800 text-slate-400 border-slate-700",
    icon: "help-circle",
  },
};
