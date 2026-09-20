export interface StateOption {
  value: string;
  label: string;
}

export const STATE_OPTIONS: readonly StateOption[] = [
  { value: 'bihar', label: 'Bihar' },
  { value: 'punjab', label: 'Punjab' },
  { value: 'uttar pradesh', label: 'Uttar Pradesh' },
  { value: 'jammu', label: 'Jammu' },
  { value: 'srinagar', label: 'Srinagar' },
  { value: 'madhya pradesh', label: 'Madhya Pradesh' },
  { value: 'west bengal', label: 'West Bengal' },
  { value: 'odisha', label: 'Odisha' },
  { value: 'rajasthan', label: 'Rajasthan' },
  { value: 'jharkhand', label: 'Jharkhand' },
  { value: 'assam', label: 'Assam' },
] as const;

export function getScopedStateOptions(
  userState?: string | null,
  userRole?: string | null
): StateOption[] {
  if (!userRole || userRole === 'admin' || userRole === 'nsm' || !userState) {
    return STATE_OPTIONS as StateOption[];
  }

  const assignedStates = userState
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (assignedStates.length === 0) {
    return STATE_OPTIONS as StateOption[];
  }

  const assignedSet = new Set(assignedStates);
  const matched = STATE_OPTIONS.filter((opt) =>
    assignedSet.has(opt.value.toLowerCase())
  );

  if (matched.length > 0) {
    return matched;
  }

  return assignedStates.map((st) => ({
    value: st,
    label: st.charAt(0).toUpperCase() + st.slice(1),
  }));
}
